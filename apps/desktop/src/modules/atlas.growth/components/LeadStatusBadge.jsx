import { Badge } from '@atlas/ui'
import { getLeadStatusLabel, getLeadStatusVariant } from '../lib/growth-leads.js'

export default function LeadStatusBadge({ value }) {
  return (
    <Badge variant={getLeadStatusVariant(value)}>
      {getLeadStatusLabel(value)}
    </Badge>
  )
}
