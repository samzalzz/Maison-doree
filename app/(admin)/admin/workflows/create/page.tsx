'use client'

// This page simply renders the editor in create mode.
// The [id]/page.tsx handles both create and edit when given mode param,
// but for clean routing we redirect to the create flow here.

import WorkflowEditorPage from '../[id]/page'

export default function WorkflowCreatePage() {
  return <WorkflowEditorPage params={{ id: 'create' }} />
}
