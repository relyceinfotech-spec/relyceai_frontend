export const isElementScrollable = (element) => {
    if (!element) return false;
    return element.scrollHeight > element.clientHeight;
};

export const copyMessageToClipboard = async (content) => {
    try {
        await navigator.clipboard.writeText(content);
        return true;
    } catch {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = content;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch {
            return false;
        }
    }
};

export const normalizeAssistantRole = (role) => {
    const value = String(role || '').toLowerCase().trim();
    if (value === 'assistant') return 'bot';
    return value || 'user';
};

export const isAssistantLikeRole = (role) => normalizeAssistantRole(role) === 'bot';
