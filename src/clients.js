function getStorageKey() {
    let username = 'default';
    try {
        const auth = localStorage.getItem('auth_user');
        if (auth) username = JSON.parse(auth).username || 'default';
    } catch {}
    return `clients_${username}`;
}

export function getClients() {
    const storageKey = getStorageKey();
    const stored = localStorage.getItem(storageKey);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return [];
        }
    }
    return [];
}

export function saveClients(clients) {
    const storageKey = getStorageKey();
    try {
        localStorage.setItem(storageKey, JSON.stringify(clients));
    } catch (e) {
        console.error("Failed to save clients", e);
    }
}

export function addClient(name, clients) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        return clients;
    }

    const existingClient = clients.find(c => c.toLowerCase() === trimmedName.toLowerCase());
    if (existingClient) {
        return clients;
    }

    const next = [...clients, trimmedName];
    saveClients(next);
    return next;
}

export function updateClient(oldName, newName, clients) {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || clients.find(c => c.toLowerCase() === trimmedNewName.toLowerCase())) {
        return { success: false, clients };
    }
    const index = clients.findIndex(c => c.toLowerCase() === oldName.toLowerCase());
    if (index === -1) {
        return { success: false, clients };
    }
    const next = [...clients];
    next[index] = trimmedNewName;
    saveClients(next);
    return { success: true, clients: next };
}

export function deleteClient(name, clients) {
    const index = clients.findIndex(c => c.toLowerCase() === name.toLowerCase());
    if (index === -1) {
        return { success: false, clients };
    }
    const next = [...clients];
    next.splice(index, 1);
    saveClients(next);
    return { success: true, clients: next };
}
