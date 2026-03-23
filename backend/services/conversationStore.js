/**
 * conversationStore.js
 * In-memory store for WhatsApp CRM conversations.
 * Replaces the need for a database in this prototype.
 */

const conversations = new Map();

/**
 * Creates or retrieves a conversation for a given phone number.
 */
export function getOrCreate(phone) {
    if (!conversations.has(phone)) {
        conversations.set(phone, {
            id: "conv_" + Date.now() + Math.floor(Math.random() * 1000),
            phone,
            name: phone, // Defaults to phone until we get a profile name
            leadId: null,
            leadStage: "New Lead",
            lastMessage: "",
            lastMessageTime: new Date().toISOString(),
            unread: 0,
            aiEnabled: true, // Auto-reply with Gemini by default
            aiResponseCount: 0, // Track AI replies for cost control
            messages: []
        });
    }
    return conversations.get(phone);
}

/**
 * Adds a message to a conversation.
 * @param {string} phone 
 * @param {"user"|"assistant"|"agent"} role 
 * @param {string} content 
 */
export function addMessage(phone, role, content) {
    const conv = getOrCreate(phone);
    const msg = {
        id: "msg_" + Date.now() + Math.floor(Math.random() * 1000),
        role,
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: role === "user" ? undefined : "sent"
    };

    conv.messages.push(msg);
    conv.lastMessage = content.slice(0, 80);
    conv.lastMessageTime = msg.timestamp;

    if (role === "user") {
        conv.unread += 1;
    }

    if (role === "assistant") {
        conv.aiResponseCount += 1;
    }

    // Keep history manageable
    if (conv.messages.length > 50) {
        conv.messages = conv.messages.slice(conv.messages.length - 50);
    }

    return msg;
}

/**
 * Marks all messages in a conversation as read.
 */
export function markRead(phone) {
    const conv = conversations.get(phone);
    if (conv) {
        conv.unread = 0;
        conv.messages.forEach(m => {
            if (m.role !== "user" && m.status === "sent") {
                m.status = "read";
            }
        });
    }
}

/**
 * Returns an array of all conversations, sorted by most recent.
 */
export function getAllConversations() {
    return Array.from(conversations.values()).sort((a, b) => {
        // Basic string comparison of timestamps works for this format
        return b.lastMessageTime.localeCompare(a.lastMessageTime);
    });
}

/**
 * Retrieves a single conversation by phone number.
 */
export function getConversation(phone) {
    return conversations.get(phone);
}

/**
 * Toggles AI auto-reply for a conversation.
 */
export function setAIEnabled(phone, enabled) {
    const conv = getOrCreate(phone);
    conv.aiEnabled = !!enabled;
}
