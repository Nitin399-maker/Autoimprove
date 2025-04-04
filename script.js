import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";

const $prompt = document.querySelector("#prompt");
const $submit = document.querySelector("#submit");
const $model = document.querySelector("#model");
const $response = document.querySelector("#response");

const apiUrl = "https://llmfoundry.straive.com/openrouter/v1/chat/completions";
const { token } = await fetch("https://llmfoundry.straive.com/token", { credentials: "include" }).then((res) =>
  res.json()
);

const marked = new Marked();
const messages = [{ role: "system", content: "Generate a single page HTML app in a single Markdown code block." }];

const demoList = [
  { id: 'circle', title: 'Circle Drawing', icon: 'bi-circle' },
  { id: 'minesweeper', title: 'minesweeper', icon: 'bi-controller' },
  { id: 'fractal', title: 'Fractal', icon: 'bi-snow' },
  { id: 'rain', title: 'Rain Simulation', icon: 'bi-cloud-rain' },
  { id: 'game', title: 'Simple Game', icon: 'bi-controller' },
  { id: 'clock', title: 'Analog Clock', icon: 'bi-clock' },
  { id: 'snake', title: 'Snake Game', icon: 'bi-joystick' },
  { id: 'paint', title: 'Paint App', icon: 'bi-palette' }
];

document.querySelector("#app-prompt").addEventListener("submit", async (e) => {
  e.preventDefault();

  messages.push({ role: "user", content: $prompt.value });
  const body = JSON.stringify({ model: $model.value, messages, stream: true });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}:autoimprove` };

  messages.push({ role: "assistant", content: "", loading: true });
  drawMessages(messages);
  const lastMessage = messages.at(-1);
  for await (const data of asyncLLM(apiUrl, { method: "POST", headers, body })) {
    lastMessage.content = data.content;
    if (!lastMessage.content) continue;
    drawMessages(messages);
  }
  delete lastMessage.loading;
  drawMessages(messages);
  // Auto size the last iframe
  const iframes = $response.querySelectorAll("iframe");
  if (iframes.length) {
    const frame = iframes[iframes.length - 1];
    frame.style.height = `${frame.contentWindow.document.body.scrollHeight + 200}px`;
  }

  $submit.textContent = "Improve";
  $prompt.value = "Improve this app!";
});

const loadingHTML = html` <div class="d-flex justify-content-center align-items-center">
  <div class="spinner-border" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</div>`;

function drawMessages(messages) {
  render(
    messages.map(
      ({ role, content, loading }) => html`
        <section class="message ${role}-message mb-4">
          <div class="fw-bold text-capitalize mb-2">${role}:</div>
          <div class="message-content">${unsafeHTML(marked.parse(content))}</div>
          ${role == "assistant" ? (loading ? loadingHTML : unsafeHTML(drawOutput(content))) : ""}
        </section>
      `
    ),
    $response
  );
}

const contentCache = {};

function drawOutput(content) {
  if (contentCache[content]) return contentCache[content];

  // Find the first code block in the markdown content
  const match = content.match(/```[\w-]*\n([\s\S]*?)\n```/);
  if (!match) return "";

  // Draw it in an iframe
  const iframe = document.createElement("iframe");
  iframe.className = "w-100 border rounded";
  iframe.style.minHeight = "300px";
  iframe.srcdoc = match[1];

  contentCache[content] = iframe.outerHTML;
  return contentCache[content];
}

document.querySelector("#save-conversation").addEventListener("click", () => {
  const modal = new bootstrap.Modal(document.getElementById('saveModal'));
  const input = document.getElementById('filename');
  input.value = `conversation_${Date.now()}`;
  
  const saveHandler = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      const fileHandle = await handle.getFileHandle(`${input.value}.js`, { create: true });
      const writable = await fileHandle.createWritable();
      const fileContent = `const conversation = ${JSON.stringify(messages, null, 2)};`;
      await writable.write(fileContent);
      await writable.close();
      modal.hide();
      const toast = new bootstrap.Toast(Object.assign(document.createElement('div'), {
        className: 'toast position-fixed bottom-0 end-0 m-3',
        innerHTML: `
          <div class="toast-header bg-success text-white">
            <strong class="me-auto">Success</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
          </div>
          <div class="toast-body">Conversation saved as ${input.value}.js</div>
        `
      }));
      document.body.appendChild(toast.element);
      toast.show();
      setTimeout(() => document.body.removeChild(toast.element), 3000);
    } catch (error) {
      const errorMsg = error.name === 'SecurityError' ? 
        'Please try saving again. The file picker requires a direct user interaction.' : 
        `Save failed: ${error.message}`;
      console.error("Error saving:", error);
      const toast = new bootstrap.Toast(Object.assign(document.createElement('div'), {
        className: 'toast position-fixed bottom-0 end-0 m-3',
        innerHTML: `
          <div class="toast-header bg-danger text-white">
            <strong class="me-auto">Error</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
          </div>
          <div class="toast-body">${errorMsg}</div>
        `
      }));
      document.body.appendChild(toast.element);
      toast.show();
      setTimeout(() => document.body.removeChild(toast.element), 3000);
    }
  };

  document.getElementById('saveButton').onclick = saveHandler;
  modal.show();
  setTimeout(() => input.focus(), 500);
});

document.querySelector("#load-conversation").addEventListener("click", async () => {
  const folderPath = 'files';
  const files = await getFilesFromFolder(folderPath);
  files && files.length ? showFileSelectionDialog(files,folderPath) : alert("No files found.");
});

async function showFileSelectionDialog(fileUrls,folderPath) {
  return new Promise((resolve) => {
    const modal = new bootstrap.Modal(document.getElementById('loadModal'));
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = ''; // Clear existing files

    fileUrls.forEach(fileUrl => {
      const fileName = fileUrl.split('/').pop();
      const fullFileUrl = `${window.location.origin}/${folderPath}/${fileName}`;
      const button = document.createElement('button');
      button.className = 'list-group-item list-group-item-action';
      button.textContent = fileName;
      
      button.addEventListener('click', async () => {
        try {
          const response = await fetch(fullFileUrl);
          if (!response.ok) throw new Error(`Fetch failed: ${fullFileUrl}`);
          const fileContent = await response.text();
          let conversation;
          try {
            conversation = eval(fileContent + '; conversation');
          } catch (error) {
            console.error("Parse error:", error);
            modal.hide();
            alert("Load failed.");
            return;
          }
          messages.length = 0;
          messages.push(...conversation);
          drawMessages(messages);
          modal.hide();
          resolve();
        } catch (error) {
          console.error("Load error:", error);
          alert("Load failed.");
        }
      });
      
      fileList.appendChild(button);
    });

    modal.show();
    modal._element.addEventListener('hidden.bs.modal', () => resolve(null));
  });
}

async function getFilesFromFolder(folderPath) {
  try {
    const response = await fetch(folderPath, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {  // Fixed missing parenthesis
      return await response.json();
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }
  } catch (error) {
    console.error("Fetch files error:", error);
    return [];
  }
}

function renderDemos() {
  const demosContainer = document.getElementById('demos');
  demosContainer.innerHTML = demoList.map(demo => `
    <div class="col mb-4">
      <div class="card h-100 demo-card" role="button" data-demo="${demo.id}" style="cursor: pointer;">
        <div class="card-body text-center">
          <i class="bi ${demo.icon} fs-1 mb-3"></i>
          <h5 class="card-title">${demo.title}</h5>
        </div>
      </div>
    </div>
  `).join('');

  demosContainer.addEventListener('click', async (e) => {
    const card = e.target.closest('.demo-card');
    if (!card) return;
    
    const demoId = card.dataset.demo;
    try {
      const response = await fetch(`files/${demoId}.js`);
      if (!response.ok) throw new Error(`Demo not found: ${demoId}`);
      const fileContent = await response.text();
      let conversation = eval(fileContent + '; conversation');
      
      messages.length = 0;
      messages.push(...conversation);
      drawMessages(messages);
      
      const toastEl = document.createElement('div');
      toastEl.className = 'toast position-fixed bottom-0 end-0 m-3';
      toastEl.innerHTML = `
        <div class="toast-header bg-success text-white">
          <strong class="me-auto">Success</strong>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
        </div>
        <div class="toast-body">Demo "${demoId}" loaded successfully</div>
      `;
      document.body.appendChild(toastEl);
      const toast = new bootstrap.Toast(toastEl);
      toast.show();
      setTimeout(() => document.body.removeChild(toastEl), 3000);
    } catch (error) {
      console.error("Demo load error:", error);
      alert("Failed to load demo");
    }
  });
}

renderDemos();
