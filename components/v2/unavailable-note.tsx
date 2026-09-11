// Shared "this figure isn't available yet" panel for the /v2 UI.
//
// The prototype filled these places with generated mock numbers. Showing
// invented revenue in a real client's dashboard would be worse than showing
// nothing, so every card the service has no endpoint for renders this
// instead — in the same card styling as the rest of the page, so it reads
// as a known gap rather than as a broken card.
interface Props {
  // Plain-language statement of what is missing, for the user.
  message: string
  // The endpoint that would have to exist for this to work, for whoever
  // picks the gap up next.
  endpointHint: string
}

export default function UnavailableNote({ message, endpointHint }: Props) {
  return (
    <div className="py-6 px-3 text-center">
      <div className="w-9 h-9 rounded-full bg-paper border border-border mx-auto mb-2.5 flex items-center justify-center text-sand" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M12 8v4"></path>
          <path d="M12 16h.01"></path>
        </svg>
      </div>
      <div className="text-[12.5px] font-semibold text-ink mb-1">Not available yet</div>
      <p className="m-0 text-[11.5px] text-sand leading-snug max-w-[280px] mx-auto">{message}</p>
      <p className="m-0 mt-1.5 text-[10.5px] text-sand/80 leading-snug">Needs: {endpointHint}</p>
    </div>
  )
}
