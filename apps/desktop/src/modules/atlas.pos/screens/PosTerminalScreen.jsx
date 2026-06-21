import { useState } from 'react'
import { SelectField, EmptyState } from '@atlas/ui'
import { usePosOutlets } from '../hooks/usePosSettings'
import { useCreatePosOrder, useAddPosOrderLine, usePosOrder } from '../hooks/usePosOrder'
import ProductGrid from '../components/ProductGrid'
import OrderPanel from '../components/OrderPanel'
import PaymentDialog from '../components/PaymentDialog'

export default function PosTerminalScreen() {
  const [outletId, setOutletId] = useState('')
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [payDialog, setPayDialog] = useState(false)
  const { data: outlets = [] } = usePosOutlets()
  const createOrder = useCreatePosOrder()
  const addLine = useAddPosOrderLine()
  const { data: activeOrder } = usePosOrder(activeOrderId)

  function handleOutletChange(id) {
    setOutletId(id)
    setActiveOrderId(null)
  }

  function handleNewOrder() {
    if (!outletId) return
    createOrder.mutate(
      { outletId, fulfillmentType: 'DINE_IN' },
      { onSuccess: (res) => setActiveOrderId((res?.data ?? res).id) },
    )
  }

  function handleProductSelect(product) {
    if (!outletId) return
    const lineData = {
      productId: product.id,
      quantity: 1,
      unitPrice: parseFloat(product.price ?? product.base_price ?? 0),
    }
    if (!activeOrderId) {
      createOrder.mutate(
        { outletId, fulfillmentType: 'DINE_IN' },
        {
          onSuccess: (res) => {
            const order = res?.data ?? res
            setActiveOrderId(order.id)
            addLine.mutate({ orderId: order.id, ...lineData })
          },
        },
      )
      return
    }
    addLine.mutate({ orderId: activeOrderId, ...lineData })
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card shrink-0">
        <SelectField
          value={outletId}
          onChange={handleOutletChange}
          options={outlets.map((o) => ({ value: o.id, label: o.name }))}
          placeholder="Selecciona una sucursal"
          className="w-56"
        />
      </div>
      {!outletId ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            title="Selecciona una sucursal"
            description="Elige la sucursal desde la barra superior para comenzar a tomar pedidos."
          />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden">
            <ProductGrid onSelect={handleProductSelect} />
          </div>
          <div className="w-85 shrink-0 flex flex-col overflow-hidden">
            <OrderPanel
              order={activeOrder}
              onPay={() => setPayDialog(true)}
              onNewOrder={handleNewOrder}
            />
          </div>
        </div>
      )}
      {activeOrder && (
        <PaymentDialog
          open={payDialog}
          onOpenChange={setPayDialog}
          order={activeOrder}
          onSuccess={() => setActiveOrderId(null)}
        />
      )}
    </div>
  )
}
