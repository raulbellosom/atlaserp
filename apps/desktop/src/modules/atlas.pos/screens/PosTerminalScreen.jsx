import { useState } from 'react'
import { useCreatePosOrder, useAddPosOrderLine, usePosOrder } from '../hooks/usePosOrder'
import ProductGrid from '../components/ProductGrid'
import OrderPanel from '../components/OrderPanel'
import PaymentDialog from '../components/PaymentDialog'

export default function PosTerminalScreen() {
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [payDialog, setPayDialog] = useState(false)
  const createOrder = useCreatePosOrder()
  const addLine = useAddPosOrderLine()
  const { data: activeOrder } = usePosOrder(activeOrderId)

  function handleNewOrder() {
    createOrder.mutate(
      { fulfillment_type: 'DINE_IN' },
      { onSuccess: (order) => setActiveOrderId(order.id) },
    )
  }

  function handleProductSelect(product) {
    if (!activeOrderId) {
      createOrder.mutate(
        { fulfillment_type: 'DINE_IN' },
        {
          onSuccess: (order) => {
            setActiveOrderId(order.id)
            addLine.mutate({
              orderId: order.id,
              product_id: product.id,
              product_name: product.name,
              quantity: 1,
              unit_price: parseFloat(product.price ?? product.base_price ?? 0),
            })
          },
        },
      )
      return
    }
    addLine.mutate({
      orderId: activeOrderId,
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit_price: parseFloat(product.price ?? product.base_price ?? 0),
    })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
