import React, { useState } from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';

const ItemsModal = ({ stop, initialItems, onClose, onSave }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(initialItems || '[]'); } catch { return []; }
  });
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('1');

  const addItem = () => {
    if (!newName.trim()) return;
    setItems([...items, { name: newName.trim(), qty: parseInt(newQty) || 1, checked: false }]);
    setNewName('');
    setNewQty('1');
  };

  const toggleItem = (idx) => {
    const updated = items.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item);
    setItems(updated);
  };

  const removeItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 9999, 
      display: 'flex', flexDirection: 'column', padding: '24px',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2 style={{margin: 0, fontSize: '16px', fontWeight: '900', letterSpacing: '1px', color: '#f8cd00'}}>📦 BULTOS A ENTREGAR</h2>
        <button onClick={onClose} style={{background: 'none', border: 'none', color: '#fff', cursor: 'pointer'}}>
          <X size={28} />
        </button>
      </div>

      <div style={{fontSize: '12px', fontWeight: '800', color: '#666', marginBottom: '12px'}}>
        {stop.address}
      </div>

      {/* Lista de items */}
      <div style={{flex: 1, overflowY: 'auto', marginBottom: '16px'}}>
        {items.length === 0 && (
          <div style={{textAlign: 'center', padding: '30px', color: '#444', fontSize: '13px', fontWeight: '600'}}>
            Añade los productos que vas a entregar
          </div>
        )}
        {items.map((item, idx) => (
          <div key={idx} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px', backgroundColor: '#111', borderRadius: '10px',
            marginBottom: '8px', border: '1px solid #222',
            opacity: item.checked ? 0.6 : 1
          }}>
            <div onClick={() => toggleItem(idx)} style={{
              width: '24px', height: '24px', borderRadius: '6px',
              backgroundColor: item.checked ? '#22c55e' : 'transparent',
              border: `2px solid ${item.checked ? '#22c55e' : '#444'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0
            }}>
              {item.checked && <Check size={14} style={{color: '#000'}} />}
            </div>
            <div style={{flex: 1}}>
              <span style={{fontSize: '13px', fontWeight: '800', color: item.checked ? '#666' : '#fff'}}>
                {item.qty}x {item.name}
              </span>
            </div>
            <button onClick={() => removeItem(idx)} style={{background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '4px'}}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Añadir item */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '16px'}}>
        <input
          type="number" min="1" value={newQty}
          onChange={e => setNewQty(e.target.value)}
          style={{width: '60px', padding: '12px', backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '16px', fontWeight: '900', textAlign: 'center'}}
        />
        <input
          type="text" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Nombre del producto..."
          onKeyDown={e => e.key === 'Enter' && addItem()}
          style={{flex: 1, padding: '12px', backgroundColor: '#111', border: '1px solid #333', borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: '700', outline: 'none'}}
        />
        <button onClick={addItem} style={{padding: '12px', backgroundColor: '#f8cd00', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer'}}>
          <Plus size={20} />
        </button>
      </div>

      <button onClick={() => onSave(items)} style={{
        backgroundColor: '#f8cd00', color: '#000', width: '100%', padding: '18px',
        borderRadius: '14px', border: 'none', fontWeight: '900', fontSize: '14px',
        letterSpacing: '1px', cursor: 'pointer'
      }}>
        {items.some(i => i.checked) ? `GUARDAR (${items.filter(i => i.checked).length}/${items.length} ok)` : 'GUARDAR LISTA'}
      </button>
    </div>
  );
};

export default ItemsModal;
