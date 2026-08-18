// js/utils/trackUtils.js

/**
 * Zerlegt einen Gleis-String in sein Basis-Gleis (base) und die belegten Abschnitte (sections).
 * Gibt ein Objekt zurück: { base: String, sections: String[] }
 * '*' bedeutet: Das gesamte Gleis ist belegt.
 * 
 * Behandelt Edge-Cases:
 * - Reine Buchstaben: "N" -> { base: "N", sections: ["*"] }
 * - Himmelsrichtungen: "5 Nord" -> { base: "5", sections: ["NORD"] }
 * - Doppelgleise: "3/4" -> { base: "3/4", sections: ["*"] }
 * - Slash mit Buchstaben: "5a/b" -> { base: "5", sections: ["A", "B"] }
 * - Buchstabe angehängt: "5a" -> { base: "5", sections: ["A"] }
 * - Klassische Abschnitte: "3 A-C" -> { base: "3", sections: ["A", "B", "C"] }
 */
export function parseTrack(trackStr) {
    if (!trackStr) return { base: '', sections: [] };
    
    trackStr = String(trackStr).trim();
    
    // 1. Reine Buchstaben (z.B. "N", "B", "SEV")
    if (/^[A-Za-z]+$/.test(trackStr)) {
        return { base: trackStr.toUpperCase(), sections: ['*'] };
    }
    
    // 2. Doppelgleise (z.B. "3/4", "5/6") - Keine Sektionen
    if (/^\d+\/\d+$/.test(trackStr)) {
        return { base: trackStr, sections: ['*'] };
    }

    // 3. Gleise mit Himmelsrichtungen (z.B. "5 Nord", "5 Süd")
    const dirMatch = trackStr.match(/^(\d+)\s+(Nord|S[üu]d|Ost|West)$/i);
    if (dirMatch) {
        return { base: dirMatch[1], sections: [dirMatch[2].toUpperCase()] };
    }

    // 4. Zahl mit Slash-Buchstaben (z.B. "5a/b")
    const slashSectionMatch = trackStr.match(/^(\d+)([a-zA-Z])\/([a-zA-Z])$/);
    if (slashSectionMatch) {
        return {
            base: slashSectionMatch[1],
            sections: [slashSectionMatch[2].toUpperCase(), slashSectionMatch[3].toUpperCase()]
        };
    }

    // 5. Zahl mit direkt angehängtem Buchstaben (z.B. "5a")
    const singleSectionMatch = trackStr.match(/^(\d+)([a-zA-Z])$/);
    if (singleSectionMatch) {
        return {
            base: singleSectionMatch[1],
            sections: [singleSectionMatch[2].toUpperCase()]
        };
    }

    // 6. Zahl mit klassischen Abschnitten (Ranges, kommagetrennt, mit/ohne Leerzeichen)
    // Erfasst auch die reine Zahl (z.B. "3")
    const baseSectionMatch = trackStr.match(/^(\d+)\s*(.*)$/);
    if (baseSectionMatch) {
        const base = baseSectionMatch[1];
        const sectionPart = baseSectionMatch[2].trim();
        
        if (!sectionPart) {
            return { base, sections: ['*'] };
        }
        
        return { base, sections: getSectionLetters(sectionPart) };
    }

    // Fallback
    return { base: trackStr, sections: ['*'] };
}

/**
 * Extrahiert Buchstaben aus einem Abschnitts-String.
 * z.B. "A-C" -> ["A", "B", "C"]
 * z.B. "C, E" -> ["C", "E"]
 */
export function getSectionLetters(sectionStr) {
    if (!sectionStr) return ['*'];
    
    let letters = new Set();
    
    // Ranges wie "A-C"
    const rangeMatch = sectionStr.match(/([A-Z])\s*-\s*([A-Z])/i);
    if (rangeMatch) {
        const start = rangeMatch[1].toUpperCase().charCodeAt(0);
        const end = rangeMatch[2].toUpperCase().charCodeAt(0);
        for (let c = start; c <= end; c++) {
            letters.add(String.fromCharCode(c));
        }
    } else {
        // Sonstige Buchstaben aufsammeln
        const matches = sectionStr.match(/[a-z]/ig);
        if (matches) {
            matches.forEach(m => letters.add(m.toUpperCase()));
        }
    }
    
    if (letters.size === 0) return ['*'];
    return Array.from(letters);
}

/**
 * Prüft, ob sich zwei Gleis-Strings überschneiden.
 * Berücksichtigt auch Fälle wie "3/4" (überschneidet sich mit "3").
 */
export function sectionsOverlap(trackStrA, trackStrB) {
    if (!trackStrA || !trackStrB) return false;
    
    const parsedA = parseTrack(trackStrA);
    const parsedB = parseTrack(trackStrB);
    
    // Kombinierte Gleise (z.B. base "3/4" überschneidet base "3")
    const isCombinedOverlap = (
        (parsedA.base.includes('/') && parsedA.base.split('/').includes(parsedB.base)) ||
        (parsedB.base.includes('/') && parsedB.base.split('/').includes(parsedA.base))
    );

    if (parsedA.base !== parsedB.base && !isCombinedOverlap) {
        return false;
    }
    
    const l1 = parsedA.sections;
    const l2 = parsedB.sections;
    
    if (l1.includes('*') || l2.includes('*')) return true; // Ganzes Gleis = überschneidet immer
    
    return l1.some(letter => l2.includes(letter));
}

/**
 * Prüft auf exakte Gleis-Gleichheit oder Überschneidung, wenn als Vergleich genutzt.
 * Hier primär alias für sectionsOverlap, um die alte API abzubilden.
 */
export function compareTracks(trackStrA, trackStrB) {
    return sectionsOverlap(trackStrA, trackStrB);
}
