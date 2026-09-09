export const audioModules = {
    GLEIS: {
        de: { file: "016", text: "Gleis" },
        en: { file: "023", text: "Platform" },
        fr: { file: "042", text: "Voie" }
    },
    EINFAHRT: {
        de: { file: "012", text: "Einfahrt" },
        en: { file: "022", text: "Now arriving" },
        fr: { file: "022", text: "" }
    },
    //Bindewörter
    NACH: {
        de: { file: "0054", text: "nach" },
        en: { file: "0049", text: "to" },
        fr: { file: "0049", text: "" }
    },
    UEBER: {
        de: { file: "035", text: "über" },
        en: { file: "035", text: "via" },
        fr: { file: "035", text: "via" }
    },
    MIT: {
        de: { file: "031", text: "mit" },
        en: { file: "039", text: "with" },
        fr: { file: "042", text: "" }
    },
    VON: {
        de: { file: "0065", text: "von" },
        en: { file: "0012", text: "from" },
        fr: { file: "0012", text: "" }
    },
    UND: {
        de: { file: "036", text: "und" },
        en: { file: "002", text: "and" },
        fr: { file: "042", text: "et" }
    },

    UND_VON_GLEIS: {
        de: { file: "037", text: "und von Gleis" },
        en: { file: "002", text: "and from platform" },
        fr: { file: "042", text: "et" }
    },
    BIS: {
        de: { file: "006", text: "bis" },
        en: { file: "000", text: "to" },
        fr: { file: "000", text: "" }
    },
    
    //An/Ab
    ABFAHRT: {
        de: { file: "001", text: "Abfahrt" },
        en: { file: "008", text: "Departure" },
        fr: { file: "008", text: "" }
    },
    ABFAHRT_URSPRUENGLICH: {
        de: { file: "002", text: "Abfahrt ursprünglich" },
        en: { file: "027", text: "original departure" },
        fr: { file: "027", text: "" }
    },
    ANKUNFT: {
        de: { file: "004", text: "Ankunft" },
        en: { file: "026", text: "Arrival" },
        fr: { file: "026", text: "" }
    },
    ANKUNFT_URSPRUENGLICH: {
        de: { file: "005", text: "Ankunft urspünglich" },
        en: { file: "026", text: "Arrival" },
        fr: { file: "026", text: "" }
    },

    //Zugteilung
    ZUG_WIRD_IN: {
        de: { file: "045", text: "Zug wird in" },
        en: { file: "030", text: "The train will be split up in" },
        fr: { file: "042", text: "" }
    },
    ZUGTEILUNG_2: {
        de: { file: "015", text: "geteilt" },
        en: { file: "000", text: "" },
        fr: { file: "042", text: "" }
    },

    VORSICHT_BEI_DER_EINFAHRT: {
        de: { file: "046", text: "Vorsicht bei der Einfahrt" },
        en: { file: "005", text: "Caution, the train is arriving" },
        fr: { file: "005", text: "" }
    },
    
    WEITER_ALS: {
        de: { file: "040", text: "weiter als" },
        en: { file: "006", text: "continuing as" },
        fr: { file: "042", text: "" }
    },
    
    BITTE_NICHT_EINSTEIGEN: {
        de: { file: "007", text: "bitte nicht einsteigen" },
        en: { file: "024", text: "please do not board" },
        fr: { file: "024", text: "" }
    },
    STEHT: {
        de: { file: "034", text: "steht" },
        en: { file: "000", text: "stands" },
        fr: { file: "000", text: "" }
    },
    INFORMATION_ZU: {
        de: { file: "030", text: "Information zu" },
        en: { file: "020", text: "Information on" },
        fr: { file: "042", text: "" }
    },
    GRUND_ODER_VERSPAETUNG: {
        de: { file: "021", text: "Grund / Verspätung Einleitung" },
        en: { file: "011", text: "Delay / Reason intro" },
        fr: { file: "042", text: "" }
    },
    FAELLT_HEUTE_AUS: {
        de: { file: "014", text: "fällt heute aus" },
        en: { file: "021", text: "is cancelled today" },
        fr: { file: "042", text: "" }
    },

    //Abschnitte
    HEUTE_1_KLASSE_IN: {
        de: { file: "021", text: "Heute ersten Klasse in Abschnitt"},
        en: { file: "037", text: "First class coaches today in platform sections" },
        fr: { file: "042", text: "" }
    },
    IM_ABSCHNITT: {
        de: { file: "028", text: "im Abschnitt"},
        en: { file: "037", text: "in platform section" },
        fr: { file: "042", text: "" }
    },
    IN_ABSCHNITTEN: {
        de: { file: "028", text: "in den Abschnitten"},
        en: { file: "037", text: "in platform sections" },
        fr: { file: "042", text: "" }
    },

    //Haltabweichungen
    HEUTE_NUR_BIS: {
        de: { file: "021", text: "Heute nur bis" },
        en: { file: "037", text: "today only to" },
        fr: { file: "042", text: "" }
    },
    HALTAUSFALL_IN: {
        de: { file: "022", text: "Heute ohne Halt in" },
        en: { file: "038", text: "Will not call at" },
        fr: { file: "042", text: "" }
    },
    ZUSATZHALT_IN: {
        de: { file: "014", text: "Heute mit Halt in" },
        en: { file: "015", text: "makes an additional stop at" },
        fr: { file: "042", text: "" }
    },
    ERSATZZUG: {
        de: { file: "042", text: "Ersatzzug" },
        en: { file: "036", text: "Replacement train" },
        fr: { file: "042", text: "" }
    },

    //Abfertigung
    ABFERTIGUNG_1: {
        de: { file: "0048", text: "Meine Damen und Herren an Gleis" },
        en: { file: "0021", text: "Ready for departure" },
        fr: { file: "042", text: "" }
    },
    ABFERTIGUNG_2: {
        de: { file: "0011", text: "Bitte steigen Sie ein. Die Türen schließen automatisch. Vorsicht bei der Abfahrt des Zuges" },
        en: { file: "0029", text: "Please close doors" },
        fr: { file: "042", text: "" }
    },

    // Zugdurchfahrt
    ACHTUNG_GLEIS: {
        de: { file: "0153", text: "Achtung an Gleis" },
        en: { file: "040", text: "Attention at platform" },
        fr: { file: "042", text: "" }
    },
    ZUG_FAEHRT_DURCH: {
        de: { file: "0155", text: "Ein Zug fährt durch" },
        en: { file: "040", text: "A train is passing through" },
        fr: { file: "042", text: "" }
    },
    ZURUECKTRETEN: {
        de: { file: "0159", text: "Bitte treten Sie zurück" },
        en: { file: "040", text: "Please step back" },
        fr: { file: "042", text: "" }
    },
    ANSCHLUESSE: {
        de: { file: "026", text: "Ihre nächsten Anschlüsse" },
        en: { file: "040", text: "Your next connections" },
        fr: { file: "042", text: "" }
    },
    VON_GLEIS: {
        de: { file: "039", text: "von Gleis" },
        en: { file: "014", text: "from platform" },
        fr: { file: "042", text: "" }
    },

    HEUTE_AUF_GLEIS: {
        de: { file: "019", text: "Heute auf Gleis" },
        en: { file: "014", text: "Today on platform" },
        fr: { file: "042", text: "" }
    },

    HEUTE_VON_GLEIS: {
        de: { file: "023", text: "Heute von Gleis" },
        en: { file: "014", text: "Today on platform" },
        fr: { file: "042", text: "" }
    },

    ICH_WIEDERHOLE: {
        de: { file: "025", text: "Ich wiederhole" },
        en: { file: "014", text: "I repeat" },
        fr: { file: "042", text: "" }
    },
    ZUGVEREINIGUNG_TUEREN_GESCHLOSSEN: {
        de: { file: "010", text: "Die Türen bleiben während der Zugvereinigung geschlossen" },
        en: { file: "014", text: "from platform" },
        fr: { file: "042", text: "" }
    },
    DIREKT_GEGENUEBER: {
        de: { file: "011", text: "direkt gegenüber" },
        en: { file: "014", text: "directly opposite" },
        fr: { file: "042", text: "" }
    },
    ENTSCHULDIGUNG: {
        de: { file: "042", text: "Wir bitten um Entschuldigung." },
        en: { file: "036", text: "We apologize for any inconvenience." },
        fr: { file: "042", text: "Nous nous excusons." }
    }
}
