export default function ProblemSection() {
  return (
    <section className="bg-sfp-background py-20">
      <div className="max-w-xl mx-auto px-6">
        <h2 className="font-sans font-bold text-sfp-textPrimary text-2xl sm:text-3xl leading-tight mb-6">
          You're running on vibes<br />and eBay searches.
        </h2>

        <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed mb-6">
          You're standing in a thrift store holding something that looks promising.
          You open eBay's app. Type in the name. Wait for results. Scroll through
          sold listings. Do the math in your head. Three minutes gone. Someone
          else already grabbed it.
        </p>

        <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed mb-10">
          You get home with a bad buy. You list it for less than you paid and
          take the loss. You don't know if it was a bad item or a bad price —
          because you never really knew your margin. That pile of unlisted items
          in the corner isn't going anywhere.
        </p>

        <div className="bg-sfp-surface rounded p-5 mb-10">
          <p className="font-mono text-sfp-textMuted text-xs uppercase tracking-widest mb-3">
            Sound familiar?
          </p>
          <ul className="font-mono text-sfp-textSecondary text-sm space-y-3">
            <li>"I tried eBay's app but the comps are buried three pages deep."</li>
            <li>"I tried a barcode scanner but half my items don't have barcodes."</li>
            <li>"I started a spreadsheet but stopped updating it after two weeks."</li>
          </ul>
        </div>

        <div className="space-y-4 mb-12">
          <div className="bg-amber-50 rounded px-5 py-4">
            <p className="font-sans font-semibold text-sfp-textPrimary text-sm mb-1">
              At the estate sale
            </p>
            <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed">
              Three minutes into looking up a blender, someone picks it up and
              walks to the cashier. You find out later it sold on eBay for $65.
            </p>
          </div>
          <div className="bg-sfp-surface rounded px-5 py-4">
            <p className="font-sans font-semibold text-sfp-textPrimary text-sm mb-1">
              Back at home
            </p>
            <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed">
              47 unlisted items in a pile. No idea which to list first. The good
              stuff is buried under the bad buys.
            </p>
          </div>
          <div className="bg-sfp-surface rounded px-5 py-4">
            <p className="font-sans font-semibold text-sfp-textPrimary text-sm mb-1">
              End of the month
            </p>
            <p className="font-mono text-sfp-textSecondary text-sm leading-relaxed">
              You made $380. You don't know if you left money on the table or if
              the market just moved. You don't know your actual margin.
            </p>
          </div>
        </div>

        <div className="border-t border-sfp-border pt-8">
          <p className="font-sans font-bold text-sfp-textPrimary text-xl leading-snug">
            You don't need to become an expert.<br />
            You need faster data.
          </p>
        </div>
      </div>
    </section>
  );
}
