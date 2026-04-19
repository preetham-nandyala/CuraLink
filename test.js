fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({model: "qwen2.5:0.5b", prompt: "Hello"})
}).then(async res => {
    console.log(res.status, await res.text());
}).catch(console.error);
