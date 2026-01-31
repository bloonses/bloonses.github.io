// 摄像头控制变量
let videoStream = null;
let lastBlob = null;

// DOM 元素
const videoSelect = document.getElementById('videoSelect');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snapshot = document.getElementById('snapshot');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');
const sendBtn = document.getElementById('sendBtn');
const downloadLink = document.getElementById('downloadLink');

// 获取摄像头设备列表
async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    videoSelect.innerHTML = '';
    videoDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `摄像头 ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    });

    return videoDevices.length > 0;
  } catch (error) {
    console.error('获取摄像头设备失败:', error);
    return false;
  }
}

// 启动摄像头
async function startCamera() {
  try {
    const constraints = {
      video: {
        deviceId: videoSelect.value ? { exact: videoSelect.value } : undefined,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;

    // 更新按钮状态
    startBtn.disabled = true;
    stopBtn.disabled = false;
    captureBtn.disabled = false;
    sendBtn.disabled = true;

    console.log('摄像头启动成功');
  } catch (error) {
    console.error('摄像头启动失败:', error);
    alert('无法访问摄像头: ' + error.message);
  }
}

// 停止摄像头
function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
    video.srcObject = null;

    // 更新按钮状态
    startBtn.disabled = false;
    stopBtn.disabled = true;
    captureBtn.disabled = true;
    sendBtn.disabled = true;

    console.log('摄像头已停止');
  }
}

// 截图
function captureSnapshot() {
  if (!videoStream) return;

  const context = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // 显示截图预览
  canvas.toBlob(blob => {
    lastBlob = blob;
    snapshot.src = URL.createObjectURL(blob);
    sendBtn.disabled = false;

    // 设置下载链接
    downloadLink.href = snapshot.src;
    downloadLink.style.display = 'inline';

    console.log('截图完成');
  }, 'image/png');
}

// 上传截图
async function sendSnapshot() {
  if (!lastBlob) {
    alert('还没有截图');
    return;
  }

  const form = new FormData();
  form.append('file', lastBlob, 'capture.png');

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = '上传中...';

    const resp = await fetch('/upload', {
      method: 'POST',
      body: form
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const errMsg = data && data.error ? data.error : `HTTP ${resp.status}`;
      alert('上传失败: ' + errMsg);
      return;
    }

    alert('上传成功: ' + JSON.stringify(data));
  } catch (err) {
    console.error(err);
    alert('上传错误: ' + err.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = '上传截图';
  }
}

// 事件监听器
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', captureSnapshot);
sendBtn.addEventListener('click', sendSnapshot);

// 页面加载时初始化
window.addEventListener('load', async () => {
  const hasCameras = await getCameras();
  if (!hasCameras) {
    alert('未检测到摄像头设备');
    startBtn.disabled = true;
  }
});