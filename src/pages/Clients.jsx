import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getClients, addClient as addClientToStorage, updateClient, deleteClient } from '../clients';
import { updateClientInOrders, hasOrders } from '../db';

export default function Clients() {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [newClient, setNewClient] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [selectedClients, setSelectedClients] = useState([]);

  useEffect(() => {
    setClients(getClients());
  }, []);

  function handleSelectionChange(client) {
    setSelectedClients(prev =>
      prev.includes(client)
        ? prev.filter(c => c !== client)
        : [...prev, client]
    );
  }

  function handleAddClient() {
    const updatedClients = addClientToStorage(newClient, clients);
    if (updatedClients.length > clients.length) {
      setClients(updatedClients);
      setNewClient('');
    } else {
      alert(t('clients.alreadyExists'));
    }
  }

  function handleEditStart() {
    if (selectedClients.length !== 1) return;
    const clientToEdit = selectedClients[0];
    setEditingClient(clientToEdit);
    setEditedName(clientToEdit);
  }

  function handleEditCancel() {
    setEditingClient(null);
    setEditedName('');
    setSelectedClients([]);
  }

  async function handleEditSave(oldName) {
    const { success, clients: updatedClients } = updateClient(oldName, editedName, clients);
    if (success) {
      await updateClientInOrders(oldName, editedName.trim());
      setClients(updatedClients);
      handleEditCancel();
    } else {
      alert(t('clients.alreadyExists'));
    }
  }

  async function handleDeleteSelected() {
    if (selectedClients.length === 0) return;

    const clientsWithOrders = [];
    for (const clientName of selectedClients) {
      if (await hasOrders(clientName)) {
        clientsWithOrders.push(clientName);
      }
    }

    if (clientsWithOrders.length > 0) {
      alert(`${t('clients.deleteSelectedWarning')}${clientsWithOrders.join(', ')}`);
      return;
    }

    if (confirm(t('clients.deleteSelectedConfirm'))) {
      let currentClients = [...clients];
      for (const clientName of selectedClients) {
        const { success, clients: updatedClients } = deleteClient(clientName, currentClients);
        if (success) {
          currentClients = updatedClients;
        }
      }
      setClients(currentClients);
      setSelectedClients([]);
    }
  }

  return (
    <div className="clients-page">
      <h2>{t('clients.title')}</h2>

      <div className="add-client-form">
        <input
          type="text"
          value={newClient}
          onChange={(e) => setNewClient(e.target.value)}
          placeholder={t('clients.newClientPlaceholder')}
        />
        <button onClick={handleAddClient} disabled={!newClient.trim()}>
          {t('clients.addClient')}
        </button>
      </div>

      <div className="client-actions">
        <button onClick={handleEditStart} disabled={selectedClients.length !== 1}>
          {t('clients.editSelected')}
        </button>
        <button onClick={handleDeleteSelected} disabled={selectedClients.length === 0} className="danger">
          {t('clients.deleteSelected')}
        </button>
      </div>

      <div className="client-list">
        {clients.length > 0 ? (
          <ul>
            {clients.map((client, index) => (
              <li key={index}>
                <input
                  type="checkbox"
                  checked={selectedClients.includes(client)}
                  onChange={() => handleSelectionChange(client)}
                />
                {editingClient === client ? (
                  <>
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(client)} disabled={!editedName.trim() || editedName.trim() === client}>
                      {t('clients.save')}
                    </button>
                    <button className="secondary" onClick={handleEditCancel}>
                      {t('clients.cancel')}
                    </button>
                  </>
                ) : (
                  <span>{client}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('clients.noClients')}</p>
        )}
      </div>
    </div>
  );
}
