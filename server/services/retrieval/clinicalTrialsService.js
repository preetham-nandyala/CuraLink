const axios = require('axios');
const { CLINICAL_TRIALS_BASE, CLINICAL_TRIALS_PAGE_SIZE } = require('../../config/constants');

/**
 * All three statuses fetched in parallel.
 * COMPLETED trials contain the most validated outcome data — omitting them
 * was a bug in the previous version (noted in comments but never implemented).
 * RECRUITING: most actionable for patients seeking enrollment.
 * ACTIVE_NOT_RECRUITING: ongoing — results pending.
 * COMPLETED: highest evidence value; informs treatment decisions.
 */
const TRIAL_STATUSES = ['RECRUITING', 'ACTIVE_NOT_RECRUITING', 'COMPLETED'];

/**
 * ClinicalTrials.gov API v2 Service
 *
 * FIX: COMPLETED trials now actually fetched (was promised in comments, never implemented).
 * FIX: Eligibility truncated at sentence boundary, not arbitrary character count.
 * FIX: Inclusion criteria extracted separately from exclusion criteria.
 * FIX: Exponential backoff retry per status fetch.
 * FIX: Parallel fetch across all statuses for speed.
 */
class ClinicalTrialsService {
  /**
   * Fetch clinical trials from all three status groups
   * @param {Object} query - { condition, term, location }
   * @returns {Array} Normalized clinical trial objects
   */
  async fetch(query) {
    try {
      // All three statuses fetched in parallel — sequential was unnecessarily slow
      const fetches = await Promise.allSettled(
        TRIAL_STATUSES.map(status => this._fetchTrialsWithRetry(query, status))
      );

      const results = [];
      for (let i = 0; i < fetches.length; i++) {
        if (fetches[i].status === 'fulfilled') {
          results.push(...fetches[i].value);
        } else {
          console.warn(`⚠️  ClinicalTrials ${TRIAL_STATUSES[i]} fetch failed: ${fetches[i].reason?.message}`);
        }
      }

      // Deduplicate by NCT ID
      const seen = new Set();
      const unique = results.filter(trial => {
        if (!trial.nctId || seen.has(trial.nctId)) return false;
        seen.add(trial.nctId);
        return true;
      });

      console.log(`🧪 ClinicalTrials: Retrieved ${unique.length} unique trials across ${TRIAL_STATUSES.join(', ')}`);
      return unique;
    } catch (error) {
      console.error('❌ ClinicalTrials fetch error:', error.message);
      return [];
    }
  }

  /**
   * Fetch trials for a single status with exponential backoff retry
   */
  async _fetchTrialsWithRetry(query, status, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this._fetchTrials(query, status);
      } catch (err) {
        if (attempt === retries) {
          console.warn(`⚠️  ClinicalTrials ${status} failed after ${retries} attempts: ${err.message}`);
          return [];
        }
        const isRateLimit = err.response?.status === 429;
        const backoff = isRateLimit ? 3000 : Math.pow(2, attempt) * 400;
        console.warn(`⚠️  ClinicalTrials ${status} retry ${attempt}/${retries}, waiting ${backoff}ms`);
        await this._delay(backoff);
      }
    }
    return [];
  }

  /**
   * Single API call for one status type
   */
  async _fetchTrials(query, status) {
    const params = { format: 'json', pageSize: CLINICAL_TRIALS_PAGE_SIZE };

    if (query.condition) params['query.cond'] = query.condition;
    if (query.term && query.term !== query.condition) params['query.term'] = query.term;
    if (status) params['filter.overallStatus'] = status;

    const response = await axios.get(CLINICAL_TRIALS_BASE, {
      params,
      timeout: 10000,
    });

    if (!response.data || !response.data.studies) return [];

    return response.data.studies.map(study => this._normalize(study, query.location));
  }

  /**
   * Normalize clinical trial data to unified schema
   */
  _normalize(study, userLocation) {
    const protocol = study.protocolSection || {};
    const id = protocol.identificationModule || {};
    const status = protocol.statusModule || {};
    const design = protocol.designModule || {};
    const eligibility = protocol.eligibilityModule || {};
    const contacts = protocol.contactsLocationsModule || {};
    const description = protocol.descriptionModule || {};

    const locations = (contacts.locations || []).map(loc => {
      const parts = [loc.facility, loc.city, loc.state, loc.country].filter(Boolean);
      return parts.join(', ');
    });

    const centralContacts = (contacts.centralContacts || []).map(c => {
      const parts = [c.name, c.phone, c.email].filter(Boolean);
      return parts.join(' | ');
    });

    const nctId = id.nctId || '';

    return {
      type: 'clinical_trial',
      title: id.officialTitle || id.briefTitle || 'Untitled Trial',
      briefTitle: id.briefTitle || '',
      abstract: description.briefSummary || '',
      status: status.overallStatus || 'Unknown',
      nctId,
      url: nctId ? `https://clinicaltrials.gov/study/${nctId}` : '',
      eligibility: this._extractEligibility(eligibility),
      locations: locations.slice(0, 5),
      location: locations[0] || '',
      contacts: centralContacts.join('; '),
      platform: 'ClinicalTrials.gov',
      phases: (design.phases || []).join(', '),
      enrollmentCount: design.enrollmentInfo?.count || null,
      year: status.studyFirstPostDateStruct?.date
        ? parseInt(status.studyFirstPostDateStruct.date.substring(0, 4))
        : null,
      // Pre-compute location match for reranker (avoids repeated string scanning)
      locationMatch: userLocation
        ? locations.some(l => l.toLowerCase().includes(userLocation.toLowerCase()))
        : false,
    };
  }

  /**
   * Extract eligibility criteria with clean presentation.
   *
   * FIX 1: Extract inclusion criteria ONLY (before "Exclusion Criteria" heading)
   *         so the LLM receives actionable patient-facing info, not disqualifiers.
   * FIX 2: Truncate at the nearest sentence boundary within 500 chars,
   *         not an arbitrary mid-word character cut.
   */
  _extractEligibility(eligibility) {
    const ageRange = [eligibility.minimumAge, eligibility.maximumAge]
      .filter(Boolean)
      .join(' - ');
    const sex = eligibility.sex || 'ALL';
    const header = ageRange ? `Age: ${ageRange}. Sex: ${sex}. ` : '';

    const rawCriteria = eligibility.eligibilityCriteria || '';
    if (!rawCriteria) return header.trim();

    // Isolate inclusion section: text before "Exclusion Criteria" heading
    const exclusionPatterns = [
      /exclusion criteria/i,
      /who cannot participate/i,
      /ineligible if/i,
    ];
    let inclusionText = rawCriteria;
    for (const pattern of exclusionPatterns) {
      const match = rawCriteria.search(pattern);
      if (match > 50) {
        inclusionText = rawCriteria.substring(0, match).trim();
        break;
      }
    }

    // Truncate at sentence boundary (period + space or newline) within MAX_LEN
    const MAX_LEN = 500;
    let truncated = inclusionText;
    if (inclusionText.length > MAX_LEN) {
      // Find the last sentence end before the limit
      const sentenceEnd = inclusionText.search(
        new RegExp(`[^.]{0,${MAX_LEN}}\\.[\\s\\n]`)
      );
      const lastPeriod = inclusionText.lastIndexOf('.', MAX_LEN);

      if (lastPeriod > 100) {
        truncated = inclusionText.substring(0, lastPeriod + 1);
      } else {
        truncated = inclusionText.substring(0, MAX_LEN) + '...';
      }
    }

    return `${header}${truncated}`;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ClinicalTrialsService;