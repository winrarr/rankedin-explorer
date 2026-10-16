import { useEffect, useRef } from 'react'
import { MessageSquareText, X } from 'lucide-react'
import type { WorkspaceMode } from '../lib/references'

type FeedbackDialogProps = {
  isOpen: boolean
  workspace: WorkspaceMode
  onClose: () => void
}

const feedbackFormId = import.meta.env.VITE_TALLY_FEEDBACK_FORM_ID?.trim() ?? ''

function getFeedbackFormUrl(workspace: WorkspaceMode) {
  if (!/^[a-zA-Z0-9_-]+$/.test(feedbackFormId)) return null

  const query = new URLSearchParams({
    alignLeft: '1',
    hideTitle: '1',
    transparentBackground: '1',
    workspace,
  })

  return `https://tally.so/embed/${feedbackFormId}?${query.toString()}`
}

export function FeedbackDialog({ isOpen, workspace, onClose }: FeedbackDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const formUrl = getFeedbackFormUrl(workspace)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      className="feedback-dialog"
      aria-labelledby="feedback-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="feedback-dialog-panel">
        <header className="feedback-dialog-header">
          <div className="feedback-dialog-title-wrap">
            <span className="feedback-dialog-icon" aria-hidden="true"><MessageSquareText size={17} /></span>
            <div>
              <p className="section-kicker">Help improve Rankedin Explorer</p>
              <h2 id="feedback-dialog-title">Send feedback</h2>
            </div>
          </div>
          <button className="icon-button quiet" type="button" aria-label="Close feedback form" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        {formUrl ? (
          <iframe
            className="feedback-form-frame"
            src={formUrl}
            title="Anonymous feedback form"
            loading="lazy"
          />
        ) : (
          <div className="feedback-form-unavailable" role="status">
            <p>The feedback form is not connected yet.</p>
            <p>Once the form is set up, you can share feedback here without signing in.</p>
          </div>
        )}
      </div>
    </dialog>
  )
}
