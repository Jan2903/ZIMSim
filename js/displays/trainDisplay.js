// js/displays/trainDisplay.js
import { Coach } from '../models/coach.js';
import { config } from '../utils/config.js';
import { images, updateRotatingDisplay } from '../utils/utils.js';

export class TrainDisplay {
    constructor(trainData) {
        this.trainData = trainData;
        this.y = 70;
        this.aktuellesMerkmal = 'wagennummern'; // 'wagennummern', 'ausstattung', 'klasse'
        this.merkmale = ['wagennummern', 'ausstattung', 'klasse'];
        this.rotationIndex = 0;
        this.rotating = false;
        this.scrollDivs = {};
    }

    displayDirection(richtung, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        if (richtung === 0) { // Left
            ctx.moveTo(x - 2, this.y + 52); ctx.lineTo(x + 18, this.y + 32);
            ctx.moveTo(x, this.y + 50); ctx.lineTo(x + 30, this.y + 50);
            ctx.moveTo(x - 2, this.y + 48); ctx.lineTo(x + 18, this.y + 68);
        } else { // Right
            ctx.moveTo(x + 30 + 2, this.y + 52); ctx.lineTo(x + 12, this.y + 32);
            ctx.moveTo(x + 30, this.y + 50); ctx.lineTo(x, this.y + 50);
            ctx.moveTo(x + 30 + 2, this.y + 48); ctx.lineTo(x + 12, this.y + 68);
        }
        ctx.stroke();
    }

    displayStartWagon(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 3, this.y + 83); ctx.lineTo(x + 3, this.y + 20); // Left vertical
        ctx.moveTo(x + 2, this.y + 21); ctx.lineTo(x + 22, this.y - 1); // Left diagonal
        ctx.moveTo(x + 20, this.y); ctx.lineTo(x + coach.length, this.y); // Top line
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
        ctx.stroke();
    }

    displayMiddleWagon(coach, isStart, isEnd, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, this.y); ctx.lineTo(x + coach.length, this.y);
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80);
        if (isStart) {
            ctx.moveTo(x, this.y - 3); ctx.lineTo(x, this.y + 83);
        }
        if (isEnd) {
            ctx.moveTo(x + coach.length, this.y - 3); ctx.lineTo(x + coach.length, this.y + 83);
        }
        ctx.stroke();
    }

    displayEndWagon(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x, this.y); ctx.lineTo(x + coach.length - 20, this.y); //Top line
        ctx.moveTo(x + coach.length - 22, this.y - 1); ctx.lineTo(x + coach.length - 2, this.y + 22); //Right diagonal
        ctx.moveTo(x + coach.length - 3, this.y + 20); ctx.lineTo(x + coach.length - 3, this.y + 83); //Right vertical
        ctx.moveTo(x, this.y + 80); ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
        ctx.stroke();
    }

    displayLocomotive(coach, x, ctx) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x + 3, this.y + 83); // Left vertical start
        ctx.lineTo(x + 3, this.y + 40); // Left vertical up
        ctx.arcTo(x + 3, this.y + 10, x + 30, this.y + 10, 20); // Left arc
        ctx.lineTo(x + coach.length - 30, this.y + 10); // Top line
        ctx.arcTo(x + coach.length, this.y + 10, x + coach.length - 4, this.y + 40, 20); // Right arc
        ctx.lineTo(x + coach.length - 4, this.y + 83); // Right vertical down
        ctx.moveTo(x, this.y + 80); // Bottom line start
        ctx.lineTo(x + coach.length, this.y + 80); // Bottom line
        ctx.stroke();
    }

    displayCoupling(ctx, x) {
        ctx.fillStyle = 'white';
        const dotRadius = 6;
        const startY = this.y - 15;
        const endY = this.y + 100;
        const numDots = 6;
        const step = (endY - startY) / (numDots - 1);

        for (let i = 0; i < numDots; i++) {
            const y = startY + i * step;
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    displayFirstClass(coach, x, ctx, fullScreen) {
        if (coach.isFirstClass()) {
            ctx.fillStyle = 'orange';
            let len = coach.length;
            if (!fullScreen) {
                //if (coach.coach_type === 'e') len += 4;
                //else if (coach.coach_type === 'a') len -= 4;
                if (coach.coach_type === 'm') len += 4;
            }
            ctx.fillRect(x, this.y + 92, len, 20);
        }
    }

    displayClass(coach, x, ctx) {
        ctx.font = 'bold 40px "Open Sans Condensed"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (coach.isFirstClass()) {
            ctx.fillStyle = 'orange';
            ctx.fillText("1.", x + (coach.length / 2), this.y + 44);
        } else if (coach.coachClass === 2 && !coach.isLocomotive()) {
            ctx.fillStyle = 'white';
            ctx.fillText("2.", x + (coach.length / 2), this.y + 44);
        }
    }

    displayCompactClass(scaledCoaches, ctx) {
        if (!scaledCoaches || scaledCoaches.length === 0) return;

        let currentGroup = [];

        const processGroup = (group) => {
            if (group.length === 0) return;

            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];
            
            // In der Kompaktansicht wird nur die 1. Klasse hervorgehoben.
            if (firstCoach.coachClass !== 1) return;

            const startPos = firstCoach.start;
            const endPos = lastCoach.start + lastCoach.length;
            const center = (startPos + endPos) / 2;

            ctx.font = 'bold 40px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'orange';
            ctx.fillText("1.", center, this.y + 44);
        };

        for (const coach of scaledCoaches) {
            if (currentGroup.length > 0 && coach.coachClass === currentGroup[0].coachClass) {
                currentGroup.push(coach);
            } else {
                processGroup(currentGroup);
                currentGroup = [coach];
            }
        }
        processGroup(currentGroup);
    }

    displayAmenities(coach, x, ctx) {
        let imgKey;
        let scale; // image scaling factor
        if (coach.hasAmenity('f')) imgKey = 'wagenreihung_fahrrad', scale = 0.28;
        else if (coach.hasAmenity('r')) imgKey = 'wagenreihung_rollstuhl', scale = 0.24; // wheelchair
        else if (coach.hasAmenity('m')) imgKey = 'wagenreihung_mehrzweck', scale = 0.28;
        else if (coach.hasAmenity('g')) imgKey = 'wagenreihung_gastronomie', scale = 0.32;
        const img = images[imgKey];
        if (img && img.isLoaded && !img.isBroken) {
            try {
                ctx.drawImage(img, x + (coach.length / 2) - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
            } catch (err) {
                console.warn(`Failed to draw amenity image ${imgKey}:`, err);
            }
        }
    }

    displayCompactAmenities(scaledCoaches, ctx) {
        if (!scaledCoaches || scaledCoaches.length === 0) return;

        const arraysAreEqual = (a, b) => {
            if (a.length !== b.length) return false;
            const sortedA = [...a].sort();
            const sortedB = [...b].sort();
            return sortedA.every((val, index) => val === sortedB[index]);
        };

        let currentGroup = [];

        const processGroup = (group) => {
            if (group.length === 0 || group[0].amenities.length === 0) return;

            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];
            const amenities = firstCoach.amenities;

            const startPos = firstCoach.start;
            const endPos = lastCoach.start + lastCoach.length;
            const center = (startPos + endPos) / 2;

            let imgKey;
            let scale;
            if (amenities.includes('f')) { imgKey = 'wagenreihung_fahrrad'; scale = 0.28; }
            else if (amenities.includes('r')) { imgKey = 'wagenreihung_rollstuhl'; scale = 0.24; }
            else if (amenities.includes('m')) { imgKey = 'wagenreihung_mehrzweck'; scale = 0.28; }
            else if (amenities.includes('g')) { imgKey = 'wagenreihung_gastronomie'; scale = 0.32; }
            
            const img = images[imgKey];
            if (img && img.isLoaded && !img.isBroken) {
                try {
                    ctx.drawImage(img, center - (img.width * scale / 2), this.y + 42 - (img.height * scale / 2), img.width * scale, img.height * scale);
                } catch (err) {
                    console.warn(`Failed to draw compact amenity image ${imgKey}:`, err);
                }
            }
        };

        for (const coach of scaledCoaches) {
            if (currentGroup.length > 0 && arraysAreEqual(coach.amenities, currentGroup[0].amenities)) {
                currentGroup.push(coach);
            } else {
                processGroup(currentGroup);
                currentGroup = [coach];
            }
        }
        processGroup(currentGroup);
    }

    displayWagonNumbers(coach, x, ctx) {
        if (coach.coachNumber && coach.coachNumber !== 0) {
            ctx.fillStyle = 'white';
            ctx.font = '40px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(coach.coachNumber.toString(), x + (coach.length / 2), this.y + 44);
        }
    }

    displayCompactWagonNumbers(scaledCoaches, ctx) {
        if (!scaledCoaches || scaledCoaches.length === 0) return;

        let currentGroup = [];

        const processGroup = (group) => {
            if (group.length === 0) return;

            const firstCoach = group[0];
            const lastCoach = group[group.length - 1];

            const startPos = firstCoach.start;
            const endPos = lastCoach.start + lastCoach.length;
            const center = (startPos + endPos) / 2;

            const firstNumber = firstCoach.coachNumber;
            const lastNumber = lastCoach.coachNumber;

            const numberText = firstNumber === lastNumber ?
                firstNumber.toString() :
                `${firstNumber} - ${lastNumber}`;

            ctx.fillStyle = 'white';
            ctx.font = '40px "Open Sans Condensed"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(numberText, center, this.y + 44);
        };

        for (const coach of scaledCoaches) {
            // Coach must have a number to be part of a group.
            if (coach.coachNumber && coach.coachNumber !== '0' && coach.coachNumber !== '') {
                currentGroup.push(coach);
            } else {
                // End of a group, process it and reset.
                processGroup(currentGroup);
                currentGroup = [];
            }
        }

        // Process the last group if any.
        processGroup(currentGroup);
    }

    displaySectors(sectors, ctx, fullScreen, scale_factor, platform_length) {
        const threshold = fullScreen ? 50 : 50;
        ctx.fillStyle = 'white';
        ctx.font = '45px "Open Sans Condensed"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        sectors.forEach(([name, position]) => {
            const display_pos = threshold + 50 + (position * scale_factor);
            ctx.fillText(name, display_pos, 2);
        });
    }

    displayFormation(departure, displayID, fullScreen) {
        const canvas = document.getElementById(displayID);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const {
            direction = 1,
            startMeter = 0,
            groups = [],
            skalieren = false,
            gleiswechsel = "0",
            ausfall = false,
            verkehrtAb = "0",
            ankunft = false,
            infoscreen = false,
        } = departure;

        if (!fullScreen) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 280);
            ctx.stroke();
        }

        if (gleiswechsel !== "0") {
            ctx.fillStyle = 'orange';
            ctx.fillRect(3, 0, 960, 280);
            ctx.fillStyle = 'white';
            this.displayText(ctx, 'Neues Gleis', 50, 50, '67px "Open Sans Condensed"', 'white', 'left');
            this.displayText(ctx, 'New Track', 50, 125, 'italic 67px "Open Sans Condensed"', 'white', 'left');
            this.displayText(ctx, gleiswechsel, 920, 80, '128px "Open Sans Condensed"', 'white', 'right');
            return;
        } else if (infoscreen || ausfall || (verkehrtAb !== "0")) {
            ctx.fillStyle = 'white';
            ctx.fillRect(3, 0, 960, 280);
            return;
        } else if (ankunft) {
            if (fullScreen) {
                ctx.textBaseline = 'top';
                const firstGroup = groups[0] || {};
                this.displayText(ctx, 'von / from ' + (firstGroup.destination || ''), 105, 20, '67px "Open Sans Condensed"', 'white', 'left');
            }
            return;
        }

        if (groups.length === 0 || groups.every(g => g.coaches.length === 0)) return;

        const threshold = 50;
        const coachGap = fullScreen ? 8 : 0;
        const groupGap = fullScreen ? 28 : 28;
        const usableDisplayLength = fullScreen ? 1820 : 860;
        const platformLengthMeters = this.trainData.platform.length;
        let pixelPerMeter = usableDisplayLength / platformLengthMeters;

        const allCoaches = [];
        groups.forEach(group => {
            group.coaches.forEach((coach, index) => {
                allCoaches.push({ coach, group, isFirstInGroup: index === 0, isLastInGroup: index === group.coaches.length - 1 });
            });
        });
        
        const coachesToDraw = allCoaches;
        if (coachesToDraw.length === 0) return;

        let totalLengthMeters = coachesToDraw.reduce((sum, c) => sum + c.coach.length, 0);
        if (skalieren && (totalLengthMeters * pixelPerMeter) < (usableDisplayLength / 2)) {
            pixelPerMeter *= 2;
        }

        let drawableCoaches = [];
        let currentX = threshold + (startMeter * pixelPerMeter);

        for (let i = 0; i < coachesToDraw.length; i++) {
            const currentItem = coachesToDraw[i];
            const { coach, group } = currentItem;
            const coachPixelLength = coach.length * pixelPerMeter;

            // Add current coach to be drawn at currentX
            drawableCoaches.push({ ...currentItem, coachData: coach, x: currentX, pixelLength: coachPixelLength, destination: group.destination, trainNumber: group.trainNumber});

            // Advance X by the length of the coach
            currentX += coachPixelLength;

            // Now, calculate the gap to the next coach
            if (i < coachesToDraw.length - 1) {
                const nextItem = coachesToDraw[i + 1];
                const nextGroup = nextItem.group;

                // Is the next coach in a new group?
                if (group !== nextGroup) {
                
                    //TODO: Accomodate for lenght/ gaps -> reduce length of start and end coaches when coupling / gap between groups
                    // Check condition to draw coupling
                    if (group.destination !== nextGroup.destination || group.trainNumber !== nextGroup.trainNumber) {
                        // It's a group boundary. Use the larger gap.
                        const couplingX = currentX + groupGap / 2;
                        this.displayCoupling(ctx, couplingX);
                        currentX += groupGap;
                    } else {
                        // Same group, use a smaller gap.
                        currentX += groupGap / 3; // Half gap for visual separation, but no coupling dot
                    }

                } else {
                    // Same group, use a smaller gap.
                    currentX += coachGap;
                }
            }
        }

        const trainPixelStart = drawableCoaches.length > 0 ? drawableCoaches[0].x : 0;
        const trainPixelEnd = currentX;

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(threshold, 150);
        ctx.lineTo(trainPixelStart - 10, 150);
        ctx.moveTo(trainPixelEnd + 10, 150);
        ctx.lineTo(threshold + usableDisplayLength, 150);
        ctx.stroke();

        if (direction === 0) {
            this.displayDirection(direction, trainPixelStart - 40, ctx);
        } else {
            this.displayDirection(direction, trainPixelEnd + 10, ctx);
        }

        for (let i = 0; i < drawableCoaches.length; i++) {
            const item = drawableCoaches[i];
            const { coachData, x, pixelLength, isFirstInGroup, isLastInGroup, destination, trainNumber} = item;
            const drawableCoach = new Coach({ ...coachData, length: pixelLength });

            if (coachData.type === 'locomotive' && fullScreen) {
                this.displayLocomotive(drawableCoach, x, ctx);
            } else if (coachData.type === 'control_car' && isFirstInGroup) {
                this.displayStartWagon(drawableCoach, x, ctx);
            } else if (coachData.type === 'control_car' && isLastInGroup) {
                this.displayEndWagon(drawableCoach, x, ctx);
            }
            
            let isStart = isFirstInGroup;
            let isEnd = isLastInGroup;

            const previousCoach = i > 0 ? drawableCoaches[i - 1].coachData : null;
            const nextCoach = i < drawableCoaches.length - 1 ? drawableCoaches[i + 1].coachData : null;

            if (coachData.type === 'middle_car') {
                if (isLastInGroup && nextCoach && nextCoach.type === 'middle_car') {
                    isEnd = false;
                }
                
                if (isFirstInGroup && previousCoach && previousCoach.type === 'middle_car') {
                    isStart = false;
                }
                
                this.displayMiddleWagon(drawableCoach, isStart, isEnd, x, ctx);
            }

            //Ziel anzeigen
            if (isFirstInGroup) {
                if ((!previousCoach || (previousCoach.destination !== destination)) && (!previousCoach || (previousCoach.trainNumber !== trainNumber))) {
                    ctx.fillStyle = 'white';
                    ctx.font = '58px "Open Sans Condensed"';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(destination, x, this.y + 155);
                }
            }
        
            if (!coachData.open) {
                ctx.font = 'bold 48px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = 'white';
                ctx.fillText("X", x + (drawableCoach.length / 2), this.y + 44);
            } else {
                this.displayFirstClass(drawableCoach, x, ctx, fullScreen);
                if (fullScreen) {
                    if (this.aktuellesMerkmal === "klasse") this.displayClass(drawableCoach, x, ctx);
                    if (this.aktuellesMerkmal === "ausstattung") this.displayAmenities(drawableCoach, x, ctx);
                    if (this.aktuellesMerkmal === "wagennummern") this.displayWagonNumbers(drawableCoach, x, ctx);
                }
            }
        }

        if (!fullScreen) {
            const scaledCoaches = drawableCoaches.map(dc => ({ ...dc.coachData, start: dc.x, length: dc.pixelLength, coach_type: this.mapCoachType(dc) }));
            if (this.aktuellesMerkmal === "klasse") this.displayCompactClass(scaledCoaches, ctx);
            if (this.aktuellesMerkmal === "ausstattung") this.displayCompactAmenities(scaledCoaches, ctx);
            if (this.aktuellesMerkmal === "wagennummern") this.displayCompactWagonNumbers(scaledCoaches, ctx);
        }

        const platformSectors = this.trainData.platform.sections.map(s => [s.name, s.startMeter]);
        this.displaySectors(platformSectors, ctx, fullScreen, pixelPerMeter, platformLengthMeters);
    }

    mapCoachType({ coachData, isFirstInGroup, isLastInGroup }) {
        if (coachData.type === 'locomotive') return 'l';
        if (coachData.type === 'control_car') {
            if (isFirstInGroup && isLastInGroup) return 'a'; // TODO: Combined a/e for single control car/tz
            if (isFirstInGroup) return 'a';
            if (isLastInGroup) return 'e';
        }
        if (coachData.type === 'middle_car') {
            if (isFirstInGroup && isLastInGroup) return 'ma'; // TODO: Combined a/e for single wagon
            if (isFirstInGroup) return 'ma';
            if (isLastInGroup) return 'me';
            if (!isFirstInGroup && !isLastInGroup) return 'm';
        }
    }

    wrapAndDisplayText(ctx, text, x, y, maxWidth, lineHeight, font, textColor, textAlign) {
        let line = '';
        if (text !== "") {
            const words = text.split(' ');
            ctx.font = font; //needed for text length measurement

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const testWidth = ctx.measureText(testLine).width;
                if (testWidth > maxWidth && n > 0) {
                    this.displayText(ctx, line, x, y, font, textColor, textAlign)
                    line = words[n] + ' ';
                    y += lineHeight;
                } else {
                    line = testLine;
                }
            }
            this.displayText(ctx, line, x, y, font, textColor, textAlign)
        }
        return y + (line === '' ? 0 : lineHeight);
    }

    displayInfoTopText(ctx, backgroundColor, textColor, infoText1, infoText2, x1, x2) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 960, 100);
        ctx.fillStyle = textColor;
        ctx.font = '67px "Open Sans Condensed"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(infoText1, x1, 55);
        ctx.font = 'italic 67px "Open Sans Condensed"';
        ctx.fillText(infoText2, x2, 55);
    }

    displayText(ctx, text, x, y, font, textColor, textAlign) {
        ctx.font = font;
        ctx.textAlign = textAlign;
        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);
    }

    displayAusfallUndGleiswechsel(ctx, zugData, displayID, used_nr) {
        // Unpack only what we need for this specific view
        const {
            Abfahrt: abfahrt,
            Abweichend: abfahrt_a,
            Ziel: ziel,
            Gleiswechsel: gleiswechsel = "0",
            Ausfall: ausfall,
            VerkehrtAb: verkehrtAb = "0"
        } = zugData;

        // Logic for Vias (similar to before)
        const via = zugData['Via-Halte 1 Small'] || "";
        const via2 = zugData['Via-Halte 2 Small'] || "";
        const via3 = zugData['Via-Halte 3 Small'] || "";
        
        ctx.textBaseline = 'middle';

        if (ausfall) {
            this.displayInfoTopText(ctx, 'DarkRed', 'white', 'Fährt fällt aus / ', 'Cancelled', 50, 430);
        } else if (verkehrtAb !== "0") {
            this.displayInfoTopText(ctx, 'DarkRed', 'white', 'Halt entfällt hier / ', 'Stop cancelled', 50, 490);
        } else if (gleiswechsel !== "0") {
            this.displayInfoTopText(ctx, 'orange', 'white', 'Gleisänderung / ', 'Track change', 50, 450);
        }

        ctx.fillStyle = 'white';
        ctx.fillRect(3, 100, 960, 700); //white background

        this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'navy', 'left')

        this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, false, displayID, 0, 'navy', 'white');
        this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, false, displayID, 0, 'DimGrey', 'white', true, true);

        this.displayText(ctx, ziel, 50, 360, '120px "Open Sans Condensed"', 'navy', 'left')

        if (gleiswechsel !== "0") {
            const via_full = [via, via2, via3].filter(v => v !== "").join(' ');
            this.wrapAndDisplayText(ctx, via_full, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        } else if (verkehrtAb !== "0") {
            const verkehrtAbMessage = 'Verkehrt heute ab / Departing today from ' + verkehrtAb;
            this.wrapAndDisplayText(ctx, verkehrtAbMessage, 50, 520, 880, 100, '70px "Open Sans Condensed"', 'navy', 'left');
        }
    }

    displayTextInRectangle(ctx, text, x, y, font, textAlign, textHeight, rectPadding, fullScreen, displayID, cornerRadius, rectColor, textColor, inverted = false, widthLimited = false) {
        ctx.font = font;
        ctx.textAlign = textAlign

        let textWidth = ctx.measureText(text).width;

        const checkHeight = 50; // full vertical scan area
        const availableWidth = this.findMaxZugNrWidth(
            ctx, x, y, checkHeight
        );
        const finalWidth = availableWidth - 40; // 20px padding

        // Limit width 
        if (widthLimited && textWidth > finalWidth) {
            textWidth = finalWidth;
        }

        let stroke = false;
        if (text !== "") {
            if (text.includes("IC")) {
                if (fullScreen) {
                    textColor = 'navy';
                    ctx.fillStyle = 'white';
                    cornerRadius = 15;
                } else {
                    if (inverted) {
                        stroke = true;
                        cornerRadius = 10;
                        textColor = 'navy';
                        ctx.fillStyle = 'navy';
                        ctx.strokeStyle = 'navy';
                        ctx.lineWidth = 4;
                    } else {
                        textColor = 'navy';
                        ctx.fillStyle = 'white';
                        cornerRadius = 15;
                    }
                }
            } else if (text.includes("FLX")) {
                textColor = 'white';
                ctx.fillStyle = 'lime';
            } else {
                ctx.fillStyle = rectColor;
            }
            ctx.beginPath();
            //consider length limit
            if (textAlign === 'left') {
                ctx.roundRect(x - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
            } else if (textAlign === 'right') {
                ctx.roundRect(x - textWidth - rectPadding, y - textHeight / 2 - rectPadding, textWidth + 2 * rectPadding, textHeight + rectPadding, cornerRadius);
            }
            if (stroke) {
                ctx.stroke();
            } else {
                ctx.fill();
            }
            const canvas = document.getElementById(displayID);
            const zugID = fullScreen ? 1 : displayID === 'display2_zug1' ? 2 : 3;
            
            if (widthLimited){
                if (fullScreen) {
                this.displayScrollingText(canvas, zugID, 'zugNr', text, `${canvas.offsetLeft + x - textWidth - rectPadding}px`, `${canvas.offsetTop + y - (textHeight / 2) - rectPadding}px`, `${canvas.width - 50}px`, `${textHeight + rectPadding}px`, textColor, font);
                } else {
                    this.displayScrollingText(canvas, zugID, 'zugNr', text, `${canvas.offsetLeft + x - textWidth - rectPadding}px`, `${canvas.offsetTop + y - (textHeight / 2) - rectPadding}px`, `${textWidth + 2 * rectPadding}px`, `${textHeight + rectPadding}px`, textColor, font);
                }
           
            } else {
                this.displayText(ctx, text, x, y, font, textColor, textAlign);
            }
        }
    }

    displayScrollingText(canvas, zugID, scrollingID, text, left, top, width, height, color, font) {
        // Ensure object exists
        if (!this.scrollDivs[zugID]) {
            this.scrollDivs[zugID] = {};
        }

        // Remove old one
        this.scrollDivs[zugID][scrollingID]?.remove();

        if (text === "") {
            delete this.scrollDivs[zugID][scrollingID];
            return null;
        }

        const scrollDiv = document.createElement('div');
        scrollDiv.classList.add('scroll-container');
        scrollDiv.style.left = left;
        scrollDiv.style.top = top;
        scrollDiv.style.width = width;
        scrollDiv.style.height = height;
        canvas.parentElement.appendChild(scrollDiv);

        const inner = document.createElement('div');
        inner.classList.add('scroll-text');
        inner.style.color = color;
        inner.style.font = font;
        inner.style.lineHeight = height;

        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.font = font;
        const text_width = tempCtx.measureText(text).width;
        const scroll_width = parseInt(width);

        if ((text_width > scroll_width) || ((scrollingID === "ankunft") || (scrollingID === 'arrival'))) {
            let connect = ' +++ '
            if ((scrollingID === "ankunft") || (scrollingID === 'arrival')) connect = ' ';
            let result = text + connect + text + connect;
            for (let i = 0; i < Math.ceil((scroll_width * 10) / text_width); i++) {
                result += text + connect;
            }
            inner.textContent = result;
            const total_width = tempCtx.measureText(result).width;
            inner.style.setProperty('--scroll-duration', `${total_width / 100}s`);
        } else {
            inner.textContent = text;
            inner.style.animation = 'none';
            inner.style.paddingLeft = '10px';
        }

        scrollDiv.appendChild(inner);

        // Store
        this.scrollDivs[zugID][scrollingID] = scrollDiv;
    }

    getBackgroundColor(ctx) {
        const canvas = ctx.canvas;
        const x = canvas.width - 25;
        const y = 200;

        // Get 1x1 pixel
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        return [pixel[0], pixel[1], pixel[2], pixel[3]];
    }

    findMaxZugNrWidth(ctx, startX, yCenter, height) {
        const bgColor = this.getBackgroundColor(ctx);  // ← dynamic!

        const halfH = height / 2;
        const top = Math.max(0, yCenter - halfH);
        const bottom = Math.min(ctx.canvas.height, yCenter + halfH);
        const checkHeight = bottom - top;

        let maxWidth = 0;

        for (let x = startX; x >= 0; x--) {
            const colData = ctx.getImageData(x, top, 1, checkHeight).data;

            let isClear = true;
            for (let i = 0; i < colData.length; i += 4) {
                if (
                    colData[i] !== bgColor[0] ||
                    colData[i + 1] !== bgColor[1] ||
                    colData[i + 2] !== bgColor[2] ||
                    colData[i + 3] !== bgColor[3]
                ) {
                    isClear = false;
                    break;
                }
            }

            if (isClear) {
                maxWidth = startX - x + 1;
            } else {
                break;
            }
        }

        return maxWidth;
    }

    displayTrainInfo(departure, displayID, fullScreen) {
        const canvas = document.getElementById(displayID);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const {
            groups = [],
            scrollText = "",
            Gleiswechsel: gleiswechsel = "0",
            Ausfall: ausfall = false,
            VerkehrtAb: verkehrtAb = "0",
            Ankunft: ankunft = false,
            Infoscreen: infoscreen = false
        } = departure;

        const mainGroup = groups[0] || {};
        const abfahrt = mainGroup.scheduledTime || "";
        const abfahrt_a = mainGroup.expectedTime || "";
        const nr = mainGroup.trainNumber || "";
        const used_nr = nr;

        let x = this.displayPictograms(scrollText, nr, displayID, fullScreen, ankunft);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let infoToScroll = scrollText;
        if (ankunft) infoToScroll = "Ankunft / Arrival";
        if (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0") infoToScroll = "";

        ctx.fillStyle = 'white';
        if (infoToScroll !== "") ctx.fillRect(x, 0, canvas.width - x, 100);

        const zugID = fullScreen ? 1 : (displayID === 'display2_zug1' ? 2 : 3);
        this.displayScrollingText(
            canvas, zugID, "info", infoToScroll,
            `${canvas.offsetLeft + x + 5}px`,
            `${canvas.offsetTop}px`,
            `${canvas.width - x - 5}px`,
            '100px',
            'navy',
            '67px "Open Sans Condensed"'
        );

        if (!fullScreen && (infoscreen || gleiswechsel !== "0" || ausfall || verkehrtAb !== "0")) {
            const zugDataForHelper = {
                Abfahrt: abfahrt, Abweichend: abfahrt_a, Ziel: mainGroup.destination || "",
                'Via-Halte 1 Small': (mainGroup.vias || [])[0] || "", 'Via-Halte 2 Small': (mainGroup.vias || [])[1] || "", 'Via-Halte 3 Small': (mainGroup.vias || [])[2] || "",
                Gleiswechsel: gleiswechsel, Ausfall: ausfall, VerkehrtAb: verkehrtAb,
            };
            if (infoscreen) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, 960, 800);
                this.wrapAndDisplayText(ctx, scrollText, 50, 120, 900, 80, '70px "Open Sans Condensed"', 'navy', 'left');
            } else {
                this.displayAusfallUndGleiswechsel(ctx, zugDataForHelper, displayID, used_nr);
            }
            return;
        }

        if (!fullScreen) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(0, 800);
            ctx.stroke();
        }

        if (fullScreen) {
            this.displayText(ctx, abfahrt, 100, 220, '180px "Open Sans Condensed"', 'white', 'left');
            this.displayTextInRectangle(ctx, abfahrt_a, 520, 215, '120px "Open Sans Condensed"', 'left', 120, 20, fullScreen, displayID, 0, 'white', 'navy');
            this.displayTextInRectangle(ctx, nr, 1855, 220, '100px "Open Sans Condensed"', 'right', 100, 15, fullScreen, displayID, 0, 'DimGrey', 'white', false, true);

            if (ankunft) {
                const fromDestination = mainGroup.destination || "";
                this.displayText(ctx, "Bitte nicht einsteigen", 110, 450, '180px "Open Sans Condensed"', 'white', 'left');
                this.displayText(ctx, "Please do not board", 105, 670, 'italic 180px "Open Sans Condensed"', 'white', 'left');
                this.displayText(ctx, 'von / from ' + fromDestination, 112, 850, '70px "Open Sans Condensed"', 'white', 'left');
            } else {
                let yPos = 420;
                const destFont = groups.length > 1 ? '140px "Open Sans Condensed"' : '180px "Open Sans Condensed"';
                const viaFont = groups.length > 1 ? '60px "Open Sans Condensed"' : '70px "Open Sans Condensed"';
                const lineSpacing = groups.length > 1 ? 150 : 200;

                for (const group of groups) {
                    const destText = `${group.trainNumber} ${group.destination}`;
                    this.displayText(ctx, destText, 100, yPos, destFont, 'white', 'left');
                    const viaText = (group.vias || []).join(' - ');
                    this.displayText(ctx, viaText, 112, yPos + lineSpacing * 0.5, viaFont, 'white', 'left');
                    yPos += lineSpacing;
                }
            }
        } else {
            this.displayText(ctx, abfahrt, 50, 200, '120px "Open Sans Condensed"', 'white', 'left');
            this.displayTextInRectangle(ctx, abfahrt_a, 330, 195, '90px "Open Sans Condensed"', 'left', 90, 10, fullScreen, displayID, 0, 'white', 'navy');
            this.displayTextInRectangle(ctx, used_nr, 890, 200, '75px "Open Sans Condensed"', 'right', 75, 10, fullScreen, displayID, 0, 'DimGrey', 'white', false, true);

            if (ankunft) {
                const fromDestination = mainGroup.destination || "";
                this.displayText(ctx, 'von / from ' + fromDestination, 50, 360, '67px "Open Sans Condensed"', 'white', 'left');
                this.displayScrollingText(canvas, zugID, 'ankunft', "Bitte nicht einsteigen", `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 420}px`, `${canvas.width - 50}px`, '120px', 'white', '120px "Open Sans Condensed"');
                this.displayScrollingText(canvas, zugID, 'arrival', "Please do not board", `${canvas.offsetLeft + 50}px`, `${canvas.offsetTop + 560}px`, `${canvas.width - 50}px`, '120px', 'white', 'italic 120px "Open Sans Condensed"');
            } else {
                let yPos = 360;
                const destFont = groups.length > 1 ? '90px "Open Sans Condensed"' : '120px "Open Sans Condensed"';
                const viaFont = '70px "Open Sans Condensed"';
                const destLineHeight = groups.length > 1 ? 100 : 160;
                const viaLineHeight = 80;

                for (const group of groups) {
                    this.displayText(ctx, group.destination, 50, yPos, destFont, 'white', 'left');
                    this.displayTextInRectangle(ctx, group.trainNumber, 890, yPos, '75px "Open Sans Condensed"', 'right', 75, 10, fullScreen, displayID, 0, 'DimGrey', 'white', false, true);
                    yPos += destLineHeight;
                    const viaText = (group.vias || []).join(' ');
                    yPos = this.wrapAndDisplayText(ctx, viaText, 50, yPos, 880, viaLineHeight, viaFont, 'white', 'left');
                    yPos += 20;
                }
            }
        }
    }

    displayPictograms(info, nr, displayID, fullScreen, ankunft) {

        const canvas = document.getElementById(displayID);
        const ctx = canvas.getContext('2d');
        let x = fullScreen ? 100 : 50;
        if (!ankunft) {
            const step = 105;
            const drawImageSafe = (imgKey, scale, img_x, img_y, tintColor = null) => {
                const img = images[imgKey];
                if (img && img.isLoaded && !img.isBroken) {
                    try {
                        let drawImg = img; // Default to original image
                        let drawWidth = img.width * scale;
                        let drawHeight = img.height * scale;
                        if (tintColor) {
                            // Create offscreen canvas for tinting if needed
                            const offCanvas = document.createElement('canvas');
                            offCanvas.width = img.width;
                            offCanvas.height = img.height;
                            const offCtx = offCanvas.getContext('2d');
                            offCtx.drawImage(img, 0, 0);
                            offCtx.globalCompositeOperation = 'source-in';
                            offCtx.fillStyle = tintColor;
                            offCtx.fillRect(0, 0, img.width, img.height);
                            offCtx.globalCompositeOperation = 'source-over'; // Reset
                            drawImg = offCanvas; // Use tinted version
                        }
                        // Draw (centered at img_x, img_y)
                        ctx.drawImage(drawImg, img_x - (drawWidth / 2), img_y - (drawHeight / 2), drawWidth, drawHeight);
                    } catch (err) {
                        console.warn(`Failed to draw pictogram ${imgKey}:`, err);
                    }
                } else {
                    console.warn(`Pictogram ${imgKey} not loaded or broken`);
                }
            };

            if (info.includes("Zug fällt heute aus") || info.includes("Keine Weiterfahrt nach")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw blue cross
                ctx.strokeStyle = 'navy';
                ctx.lineWidth = 12;
                ctx.beginPath();
                ctx.moveTo(x + 28, 28); ctx.lineTo(x + 72, 72);
                ctx.moveTo(x + 72, 28); ctx.lineTo(x + 28, 72);
                ctx.stroke();
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (nr.includes("FLX")) { //Reservierungspflicht Flixtrain
                //Draw white outline box
                ctx.lineWidth = "4";
                ctx.strokeStyle = 'white';
                ctx.strokeRect(x + 2, 2, 96, 96);
                //Draw R text
                ctx.fillStyle = 'white';
                ctx.font = '48px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("R", x + 75, 28);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (nr.includes("IC")) { //Reservierungspflicht Fahrrad
                //Draw white outline box
                ctx.lineWidth = "4";
                ctx.strokeStyle = 'white';
                ctx.strokeRect(x + 2, 2, 96, 96);
                //Draw bicycle icon
                drawImageSafe('wagenreihung_fahrrad', 0.40, x + 50, 66);
                //Draw R text
                ctx.fillStyle = 'white';
                ctx.font = '48px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("R", x + 75, 28);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Heute mit Halt in")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw H text
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 68px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("H", x + 30, 60);
                //Draw plus sign 
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 64px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("+", x + 65, 48);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Heute ohne Halt in")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw H text
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 68px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("H", x + 30, 60);
                //Draw minus sign 
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 64px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("-", x + 60, 36);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Mehrere Wagen fehlen") || info.includes("Ein Wagen fehlt")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw missing wagons icon
                drawImageSafe('wagen_fehlen', 1, x + 50, 50, 'navy');
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Kein gastronomisches Angebot")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw gastronomy icon
                drawImageSafe('wagenreihung_gastronomie', 0.5, x + 30, 50, 'navy');
                // Draw red slash over the icon
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 12;
                ctx.beginPath();
                ctx.moveTo(x + 10, 90);
                ctx.lineTo(x + 90, 10);
                ctx.stroke();
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Universal-WC fehlt") || info.includes("Kein behindertengerechtes WC")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw wheelchair icon
                drawImageSafe('wagenreihung_rollstuhl', 0.32, x + 32, 28, 'navy');
                //Draw WC text
                ctx.fillStyle = 'navy';
                ctx.font = '48px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("WC", x + 66, 75);
                // Draw red slash over the icon
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 12;
                ctx.beginPath();
                ctx.moveTo(x + 10, 90);
                ctx.lineTo(x + 90, 10);
                ctx.stroke();
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Defekte fahrzeuggebundene Einstiegshilfe")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw wheelchair icon
                drawImageSafe('wagenreihung_rollstuhl', 0.5, x + 50, 50, 'navy');
                //Draw exclamation mark on the top right corner
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 56px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("!", x + 80, 36);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Eingeschränkte Fahrradbeförderung")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw bicycle icon
                drawImageSafe('wagenreihung_fahrrad', 0.40, x + 50, 66, 'navy');
                //Draw exclamation mark on the top right corner
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 56px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("!", x + 80, 36);
                //Move to the right for next icon or scrolling text start
                x += step;
            }

            if (info.includes("Eingeschränktes gastronomisches Angebot")) {
                //Draw white filled box
                ctx.fillStyle = 'white';
                ctx.fillRect(x, 0, 100, 100);
                //Draw gastronomy icon
                drawImageSafe('wagenreihung_gastronomie', 0.5, x + 30, 50, 'navy');
                //Draw exclamation mark on the top right corner
                ctx.fillStyle = 'navy';
                ctx.font = 'bold 56px "Open Sans Condensed"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText("!", x + 80, 36);
                //Move to the right for next icon or scrolling text start
                x += step;
            }
        }

        return x
    }

    onFeatureButtonChange(value) {
        if (value === "rotierend") {
            this.rotating = true;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.startFeatureRotation();
        } else {
            this.rotating = false;
            if (config.feature_rotation_timer) clearTimeout(config.feature_rotation_timer);
            this.aktuellesMerkmal = value;
            this.updateAll();
        }
    }

    startFeatureRotation() {
        if (!this.rotating) return;
        this.aktuellesMerkmal = this.merkmale[this.rotationIndex];
        this.rotationIndex = (this.rotationIndex + 1) % this.merkmale.length;
        this.updateAll();
        config.feature_rotation_timer = setTimeout(() => this.startFeatureRotation(), 3000);
    }

    update(departureIndex, info_canvas_id, wagen_canvas_id, fullScreen) {
        try {
            const departure = this.trainData.departures[departureIndex];

            if (!departure) {
                const info_canvas = document.getElementById(info_canvas_id);
                if (info_canvas) info_canvas.getContext('2d').clearRect(0, 0, info_canvas.width, info_canvas.height);
                const wagen_canvas = document.getElementById(wagen_canvas_id);
                if (wagen_canvas) wagen_canvas.getContext('2d').clearRect(0, 0, wagen_canvas.width, wagen_canvas.height);
                // console.warn(`Departure data for index ${departureIndex} is undefined.`);
                return;
            }

            this.displayTrainInfo(departure, info_canvas_id, fullScreen);
            this.displayFormation(departure, wagen_canvas_id, fullScreen);

        } catch (err) {
            console.error(`Error in update for departure index ${departureIndex}:`, err);
        }
    }
    updateAll() {
        this.update(0, 'display1', 'display1_wagenreihung', true);
        this.update(1, 'display2_zug1', 'display2_zug1_wagenreihung', false);

        // NOTE: External functions like `updateRotatingDisplay` must be adapted to call `update` with an index.
        if (config.rotate_3_6) {
            updateRotatingDisplay();
        } else {
            const departureIndex = config.current_display3_zug - 1;
            this.update(departureIndex, 'display2_zug2', 'display2_zug2_wagenreihung', false);
        }
        /* for (let zugID = 1; zugID <= 3; zugID++) {
            try {
                if (zugID === 1) {
                    this.update(1, 'display1', 'display1_wagenreihung', true);
                } else if (zugID === 2) {
                    this.update(2, 'display2_zug1', 'display2_zug1_wagenreihung', false);
                } else if (zugID === 3) {
                    if (config.rotate_3_6) {
                        updateRotatingDisplay();
                    } else {
                        this.update(config.current_display3_zug, 'display2_zug2', 'display2_zug2_wagenreihung', false);
                    }
                }
            } catch (err) {
                console.error(`Failed to update display for zug_${zugID}:`, err);
            }
        } */
    }
}