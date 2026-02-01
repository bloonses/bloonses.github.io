// 摄像头控制变量
let videoStream = null;
let lastBlob = null;
let isUploading = false;

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

// 免费上传服务配置（无需API密钥）
const UPLOAD_SERVICES = {
    // 备用服务
    LITTERBOX: 'https://litterbox.catbox.moe/resources/internals/api.php',
    TEMP_SH: 'https://tmpfiles.org/api/v1/upload'
};

// 显示状态信息
function showStatus(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    let statusDiv = document.getElementById('status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'status';
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        document.body.appendChild(statusDiv);
    }

    statusDiv.textContent = message;

    switch(type) {
        case 'success':
            statusDiv.style.backgroundColor = '#d4edda';
            statusDiv.style.color = '#155724';
            statusDiv.style.border = '1px solid #c3e6cb';
            break;
        case 'error':
            statusDiv.style.backgroundColor = '#f8d7da';
            statusDiv.style.color = '#721c24';
            statusDiv.style.border = '1px solid #f5c6cb';
            break;
        case 'warning':
            statusDiv.style.backgroundColor = '#fff3cd';
            statusDiv.style.color = '#856404';
            statusDiv.style.border = '1px solid #ffeaa7';
            break;
        default:
            statusDiv.style.backgroundColor = '#d1ecf1';
            statusDiv.style.color = '#0c5460';
            statusDiv.style.border = '1px solid #bee5eb';
    }

    statusDiv.style.display = 'block';

    if (type === 'info') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
}

// 带超时的fetch函数
async function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// 上传到Litterbox（无需API密钥）
async function uploadToLitterbox(file, fileName) {
    try {
        showStatus('正在上传到 Litterbox...', 'info');

        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('time', '72h');
        formData.append('fileToUpload', file, fileName);

        const response = await fetchWithTimeout(UPLOAD_SERVICES.LITTERBOX, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const downloadUrl = await response.text();

        if (downloadUrl && downloadUrl.startsWith('http')) {
            showStatus('Litterbox上传成功', 'success');
            return {
                downloadPage: downloadUrl,
                directLink: downloadUrl,
                fileName: fileName,
                service: 'Litterbox'
            };
        } else {
            throw new Error('Litterbox上传失败');
        }
    } catch (error) {
        console.error('Litterbox上传失败:', error);
        throw error;
    }
}

// 上传到Tmpfiles（无需API密钥）
async function uploadToTmpfiles(file, fileName) {
    try {
        showStatus('正在上传到 Tmpfiles...', 'info');

        const formData = new FormData();
        formData.append('file', file, fileName);

        const response = await fetchWithTimeout(UPLOAD_SERVICES.TEMP_SH, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'success') {
            const downloadUrl = data.data.url;
            showStatus('Tmpfiles上传成功', 'success');
            return {
                downloadPage: downloadUrl,
                directLink: downloadUrl,
                fileName: fileName,
                service: 'Tmpfiles'
            };
        } else {
            throw new Error('Tmpfiles上传失败');
        }
    } catch (error) {
        console.error('Tmpfiles上传失败:', error);
        throw error;
    }
}

// 智能上传函数（自动尝试多个服务）
async function smartUpload(file, fileName) {
    const services = [
        { name: 'Litterbox', func: uploadToLitterbox },
        { name: 'Tmpfiles', func: uploadToTmpfiles }
    ];

    for (const service of services) {
        try {
            showStatus(`尝试 ${service.name}...`, 'info');
            const result = await service.func(file, fileName);
            return result;
        } catch (error) {
            console.warn(`${service.name} 上传失败:`, error.message);
            showStatus(`${service.name} 失败，尝试下一个...`, 'warning');
            // 等待1秒再尝试下一个服务
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
    }

    throw new Error('所有上传服务都失败了');
}

// 获取摄像头设备列表
async function getCameras() {
    try {
        showStatus('正在检测摄像头设备...', 'info');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        videoSelect.innerHTML = '';

        if (videoDevices.length === 0) {
            const option = document.createElement('option');
            option.text = '未检测到摄像头';
            option.disabled = true;
            videoSelect.appendChild(option);
            return false;
        }

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `摄像头 ${index + 1}`;
            videoSelect.appendChild(option);
        });

        showStatus(`检测到 ${videoDevices.length} 个摄像头设备`, 'success');
        return true;
    } catch (error) {
        console.error('获取摄像头设备失败:', error);
        showStatus('摄像头检测失败: ' + error.message, 'error');
        return false;
    }
}

// 启动摄像头
async function startCamera() {
    try {
        if (!videoSelect.value || videoSelect.value === '未检测到摄像头') {
            alert('请先选择一个摄像头设备');
            return;
        }

        showStatus('正在启动摄像头...', 'info');

        const constraints = {
            video: {
                deviceId: videoSelect.value ? { exact: videoSelect.value } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
            }
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = videoStream;

        video.onloadedmetadata = () => {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            captureBtn.disabled = false;
            sendBtn.disabled = true;

            showStatus('摄像头启动成功', 'success');
        };

    } catch (error) {
        console.error('摄像头启动失败:', error);
        showStatus('摄像头启动失败: ' + error.message, 'error');
        alert('无法访问摄像头: ' + error.message);
    }
}

// 停止摄像头
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        video.srcObject = null;

        startBtn.disabled = false;
        stopBtn.disabled = true;
        captureBtn.disabled = true;
        sendBtn.disabled = true;

        showStatus('摄像头已停止', 'info');
    }
}

// 截图
function captureSnapshot() {
    if (!videoStream) {
        alert('请先启动摄像头');
        return;
    }

    try {
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (lastBlob) {
                URL.revokeObjectURL(snapshot.src);
            }

            lastBlob = blob;
            snapshot.src = URL.createObjectURL(blob);
            sendBtn.disabled = false;

            downloadLink.href = snapshot.src;
            downloadLink.download = `capture_${Date.now()}.png`;
            downloadLink.style.display = 'inline';

            showStatus('截图完成', 'success');
        }, 'image/png', 0.95);

    } catch (error) {
        console.error('截图失败:', error);
        showStatus('截图失败: ' + error.message, 'error');
    }
}

// 上传截图
async function sendSnapshot() {
    if (!lastBlob) {
        alert('请先截图');
        return;
    }

    if (isUploading) {
        alert('正在上传中，请稍候...');
        return;
    }

    isUploading = true;

    try {
        sendBtn.disabled = true;
        sendBtn.textContent = '上传中...';

        const fileName = `screenshot_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;

        let result;
        try {
            result = await smartUpload(lastBlob, fileName);
        } catch (uploadError) {
            // 如果所有服务都失败，提供本地保存选项
            if (confirm('所有上传服务都失败了，是否保存到本地？')) {
                const link = document.createElement('a');
                link.download = fileName;
                link.href = URL.createObjectURL(lastBlob);
                link.click();
                showStatus('已保存到本地', 'info');
                return;
            } else {
                throw uploadError;
            }
        }

        const fileUrl = result.downloadPage || result.directLink;
        const message = `✅ 上传成功！\n\n📁 服务: ${result.service}\n🔗 文件链接: ${fileUrl}\n⏰ 有效期: ${getExpiryTime(result.service)}`;

        if (confirm('上传成功！是否查看详细信息？')) {
            alert(message);
        }

        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(fileUrl);
                showStatus('链接已复制到剪贴板', 'success');
            } catch (copyError) {
                console.log('复制失败，但上传成功');
            }
        }

        showStatus(`${result.service}上传成功`, 'success');

    } catch (err) {
        console.error('上传失败:', err);
        showStatus('上传失败: ' + err.message, 'error');
    } finally {
        isUploading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '上传到云端';
    }
}

// 获取服务有效期
function getExpiryTime(service) {
    switch(service) {
        case 'Litterbox': return '1小时';
        case 'Tmpfiles': return '24小时';
        default: return '未知';
    }
}

// 事件监听器
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', captureSnapshot);
sendBtn.addEventListener('click', sendSnapshot);

navigator.mediaDevices.addEventListener('devicechange', getCameras);

// 页面加载时初始化
window.addEventListener('load', async () => {
    showStatus('页面加载中...', 'info');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatus('您的浏览器不支持摄像头功能', 'error');
        startBtn.disabled = true;
        captureBtn.disabled = true;
        return;
    }

    const hasCameras = await getCameras();
    if (!hasCameras) {
        startBtn.disabled = true;
    }

    showStatus('就绪', 'success');
});

window.addEventListener('beforeunload', () => {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
    }
    if (lastBlob) {
        URL.revokeObjectURL(snapshot.src);
    }
});
