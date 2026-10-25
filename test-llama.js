async function askLocalLlama(prompt) {
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2', prompt, stream: false })
  });
  const data = await res.json();
  return data.response;
}

askLocalLlama("Give me a one-sentence cosmic status update for PrimordiaOS.")
  .then(console.log);
