import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { formatPrice, formatQuantity } from "../market";
import type { Order } from "../types";

interface OpenOrdersProps {
  orders: Order[];
  busyOrderId?: string;
  onCancel: (orderId: string) => Promise<void>;
  onModify: (orderId: string, price: number, quantity: number) => Promise<void>;
}

export function OpenOrders({ orders, busyOrderId, onCancel, onModify }: OpenOrdersProps) {
  const [editingId, setEditingId] = useState<string>();
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  function startEdit(order: Order) {
    setEditingId(order.id);
    setPrice(order.price.toFixed(2));
    setQuantity(String(order.quantity));
  }

  async function save(orderId: string) {
    await onModify(orderId, Number(price), Number(quantity));
    setEditingId(undefined);
  }

  return (
    <section className="panel orders-panel" aria-labelledby="orders-title">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">SIM-TRADER</span>
          <h2 id="orders-title">My open orders</h2>
        </div>
        <span className="count-badge">{orders.length} working</span>
      </div>
      <div className="orders-table-wrap">
        <table>
          <thead><tr><th>Side</th><th>Type</th><th>Price</th><th>Remaining</th><th>Submitted</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6}><div className="empty-state inline"><strong>No working orders</strong><span>Non-marketable limit orders will appear here.</span></div></td></tr>
            ) : orders.map(order => {
              const editing = editingId === order.id;
              return (
                <tr key={order.id}>
                  <td><span className={`side-tag ${order.side}`}>{order.side}</span></td>
                  <td className="muted-cell">{order.type}</td>
                  <td>{editing ? <input aria-label="New price" className="table-input" type="number" min="0.01" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /> : formatPrice(order.price)}</td>
                  <td>{editing ? <input aria-label="New quantity" className="table-input" type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /> : formatQuantity(order.quantity)}</td>
                  <td className="muted-cell">{new Date(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                  <td className="order-actions">
                    {editing ? (
                      <>
                        <button type="button" className="icon-button confirm" aria-label={`Save changes to ${order.id}`} disabled={busyOrderId === order.id || Number(price) <= 0 || Number(quantity) <= 0} onClick={() => void save(order.id)}><Check size={15} /></button>
                        <button type="button" className="icon-button" aria-label="Discard changes" onClick={() => setEditingId(undefined)}><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="icon-button" aria-label={`Modify ${order.id}`} onClick={() => startEdit(order)}><Pencil size={14} /></button>
                        <button type="button" className="cancel-button" disabled={busyOrderId === order.id} onClick={() => void onCancel(order.id)}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
