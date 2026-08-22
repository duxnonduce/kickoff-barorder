export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 text-sm text-stone-700 leading-relaxed">
      <h1 className="text-xl font-bold text-stone-900 mb-1">Informativa sul trattamento dei dati personali</h1>
      <p className="text-xs text-stone-400 mb-6">
        Bozza da personalizzare — sostituisci i testi in [PARENTESI QUADRE] con i dati reali del gestore
        prima di pubblicare, idealmente con la revisione di un consulente privacy.
      </p>

      <h2 className="font-semibold text-stone-900 mt-6 mb-1">Titolare del trattamento</h2>
      <p>[Ragione sociale del centro sportivo], [indirizzo], [email/PEC di contatto].</p>

      <h2 className="font-semibold text-stone-900 mt-6 mb-1">Dati raccolti</h2>
      <p>Nome, numero di telefono, email (facoltativa), e lo storico degli ordini effettuati tramite KickOff Ordina.</p>

      <h2 className="font-semibold text-stone-900 mt-6 mb-1">Finalità</h2>
      <p>
        I dati sono trattati per gestire l'ordine (comunicazione con il bar, contatto in caso di problemi
        con la consegna/ritiro) e, solo se hai dato consenso esplicito, per inviarti comunicazioni su
        offerte e novità.
      </p>

      <h2 className="font-semibold text-stone-900 mt-6 mb-1">Conservazione</h2>
      <p>I dati sono conservati per [durata], salvo diversa richiesta dell'interessato.</p>

      <h2 className="font-semibold text-stone-900 mt-6 mb-1">I tuoi diritti</h2>
      <p>
        Puoi richiedere in qualsiasi momento accesso, correzione o cancellazione dei tuoi dati scrivendo a
        [email di contatto].
      </p>
    </div>
  );
}
