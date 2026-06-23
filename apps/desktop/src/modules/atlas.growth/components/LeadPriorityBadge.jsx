import { Badge } from '@atlas/ui'
import { getLeadPriorityLabel, getLeadPriorityVariant } from '../lib/growth-leads.js'

export default function LeadPriorityBadge({ value }) {
  return (
    <Badge variant={getLeadPriorityVariant(value)}>
      {getLeadPriorityLabel(value)}
    </Badge>
  )
}
