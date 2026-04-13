import { addMinutes, isAfter, isBefore, subMinutes } from 'date-fns';

export type SchedulerSlot = {
  index: number;
  time: Date;
  sessionIndex: number;
};

export type SchedulerAdvance = {
  id: string;
  slotIndex: number;
};

export type SchedulerWalkInCandidate = {
  id: string;
  numericToken: number;
  createdAt?: Date | null;
  currentSlotIndex?: number;
};

export type SchedulerAssignment = {
  id: string;
  slotIndex: number;
  sessionIndex: number;
  slotTime: Date;
};

type SchedulerInput = {
  slots: SchedulerSlot[];
  now: Date;
  walkInTokenAllotment: number;
  advanceAppointments: SchedulerAdvance[];
  walkInCandidates: SchedulerWalkInCandidate[];
};

type SchedulerOutput = {
  assignments: SchedulerAssignment[];
};

type Occupant = {
  type: 'A' | 'W';
  id: string;
};

type AdvanceShift = {
  id: string;
  position: number;
};

export function computeWalkInSchedule({
  slots,
  now,
  walkInTokenAllotment,
  advanceAppointments,
  walkInCandidates,
}: SchedulerInput): SchedulerOutput {
  const maxInputSlotIndex = Math.max(
    ...slots.map(s => s.index),
    ...advanceAppointments.map(a => a.slotIndex),
    ...walkInCandidates.map(w => w.currentSlotIndex || -1),
    -1
  );

  const orderedSlots = [...slots].sort((a, b) => a.index - b.index);

  if (orderedSlots.length > 0) {
    const lastSlot = orderedSlots[orderedSlots.length - 1];
    const maxOccupiedIndex = Math.max(lastSlot.index, maxInputSlotIndex);
    const avgDuration = slots.length > 1
      ? (slots[1].time.getTime() - slots[0].time.getTime()) / 60000
      : 15;

    for (let i = lastSlot.index + 1; i <= maxOccupiedIndex + 10; i++) {
        orderedSlots.push({
            index: i,
            time: addMinutes(lastSlot.time, (i - lastSlot.index) * avgDuration),
            sessionIndex: lastSlot.sessionIndex
        });
    }
  }

  const positionCount = orderedSlots.length;
  if (positionCount === 0 || walkInCandidates.length === 0) {
    return { assignments: [] };
  }

  const indexToPosition = new Map<number, number>();
  orderedSlots.forEach((slot, position) => {
    indexToPosition.set(Number(slot.index), position);
  });

  const spacing =
    Number.isFinite(walkInTokenAllotment) && walkInTokenAllotment > 0
      ? Math.floor(walkInTokenAllotment)
      : 0;

  const occupancy: (Occupant | null)[] = new Array(positionCount).fill(null);
  const overflowAdvance: { id: string; sourcePosition: number }[] = [];

  advanceAppointments.forEach(entry => {
    const slotIndex = Number(entry.slotIndex);
    const position = indexToPosition.get(slotIndex);

    if (typeof position === 'number') {
      if (occupancy[position] === null) {
        occupancy[position] = { type: 'A', id: entry.id };
      } else {
        overflowAdvance.push({ id: entry.id, sourcePosition: position });
      }
    } else {
      overflowAdvance.push({ id: entry.id, sourcePosition: -1 });
    }
  });

  const sortedWalkIns = [...walkInCandidates].sort((a, b) => {
    if (a.numericToken !== b.numericToken) {
      return a.numericToken - b.numericToken;
    }
    const timeA = a.createdAt ? a.createdAt.valueOf() : 0;
    const timeB = b.createdAt ? b.createdAt.valueOf() : 0;
    return timeA - timeB;
  });

  const oneHourFromNow = addMinutes(now, 60);
  const firstFuturePosition = orderedSlots.findIndex(slot => !isBefore(slot.time, subMinutes(now, 2)));
  const effectiveFirstFuturePosition = firstFuturePosition === -1 ? positionCount : firstFuturePosition;

  const assignments = new Map<string, SchedulerAssignment>();
  const preferredPositions = new Map<string, number>();

  walkInCandidates.forEach(candidate => {
    if (typeof candidate.currentSlotIndex === 'number') {
      const position = indexToPosition.get(candidate.currentSlotIndex);
      if (typeof position === 'number') {
        preferredPositions.set(candidate.id, position);
      }
    }
  });

  const applyAssignment = (id: string, position: number) => {
    const slotMeta = orderedSlots[position];
    assignments.set(id, {
      id,
      slotIndex: slotMeta.index,
      sessionIndex: slotMeta.sessionIndex,
      slotTime: slotMeta.time,
    });
  };

  const getLastWalkInPosition = (): number => {
    for (let pos = positionCount - 1; pos >= 0; pos -= 1) {
      if (occupancy[pos]?.type === 'W') {
        return pos;
      }
    }
    return -1;
  };

  const countAdvanceAfter = (anchorPosition: number): number => {
    let count = 0;
    for (let pos = anchorPosition + 1; pos < positionCount; pos += 1) {
      const occupant = occupancy[pos];
      if (occupant?.type === 'A' && occupant.id.startsWith('__shiftable_')) {
        count += 1;
      }
    }
    return count;
  };

  const findNthAdvanceAfter = (anchorPosition: number, nth: number): number => {
    if (nth <= 0) return -1;
    let count = 0;
    for (let pos = anchorPosition + 1; pos < positionCount; pos += 1) {
      const occupant = occupancy[pos];
      if (occupant?.type === 'A' && occupant.id.startsWith('__shiftable_')) {
        count += 1;
        if (count === nth) return pos;
      }
    }
    return -1;
  };

  const findLastAdvanceAfter = (anchorPosition: number): number => {
    for (let pos = positionCount - 1; pos > anchorPosition; pos -= 1) {
      if (occupancy[pos]?.type === 'A' && occupancy[pos]?.id.startsWith('__shiftable_')) {
        return pos;
      }
    }
    return -1;
  };

  const findFirstEmptyPosition = (startPosition: number): number => {
    for (let pos = Math.max(startPosition, effectiveFirstFuturePosition); pos < positionCount; pos += 1) {
      if (occupancy[pos] !== null) continue;
      if (isBefore(orderedSlots[pos].time, now)) continue;
      return pos;
    }
    return -1;
  };

  const findEarliestWindowEmptyPosition = (): number => {
    for (let pos = Math.max(effectiveFirstFuturePosition, 0); pos < positionCount; pos += 1) {
      const slotMeta = orderedSlots[pos];
      if (isBefore(slotMeta.time, now)) continue;
      if (isAfter(slotMeta.time, oneHourFromNow)) break;
      if (occupancy[pos] === null) {
        const hasLaterAppointment = occupancy.slice(pos + 1).some(o => o !== null);
        if (hasLaterAppointment) return pos;
      }
    }
    return -1;
  };

  if (overflowAdvance.length > 0) {
    const sortedOverflow = [...overflowAdvance].sort((a, b) => a.sourcePosition - b.sourcePosition);
    for (const entry of sortedOverflow) {
      const startPosition = entry.sourcePosition >= 0
          ? Math.max(entry.sourcePosition + 1, effectiveFirstFuturePosition)
          : effectiveFirstFuturePosition;
      let emptyPosition = findFirstEmptyPosition(startPosition);
      if (emptyPosition === -1) emptyPosition = findFirstEmptyPosition(effectiveFirstFuturePosition);
      if (emptyPosition === -1) continue;

      occupancy[emptyPosition] = { type: 'A', id: entry.id };
      applyAssignment(entry.id, emptyPosition);
    }
  }

  const makeSpaceForWalkIn = (targetPosition: number, isExistingWalkIn: boolean): { position: number; shifts: AdvanceShift[] } => {
    let candidatePosition = targetPosition;
    if (candidatePosition < effectiveFirstFuturePosition) candidatePosition = effectiveFirstFuturePosition;
    
    while (
      candidatePosition < positionCount &&
      (
        occupancy[candidatePosition]?.type === 'W' ||
        (occupancy[candidatePosition]?.type === 'A' &&
          (occupancy[candidatePosition]?.id.startsWith('__reserved_') ||
            occupancy[candidatePosition]?.id.startsWith('__blocked_') ||
            occupancy[candidatePosition]?.id.startsWith('__break_')))
      )
    ) {
      candidatePosition += 1;
    }
    if (candidatePosition >= positionCount) return { position: -1, shifts: [] };

    const occupantAtCandidate = occupancy[candidatePosition];
    if (occupantAtCandidate === null) return { position: candidatePosition, shifts: [] };

    const blockPositions: number[] = [];
    for (let pos = candidatePosition; pos < positionCount; pos += 1) {
      const occupant = occupancy[pos];
      if (occupant === null) break;
      if (occupant.type === 'W') break;
      if (occupant.type === 'A') {
        if (occupant.id.startsWith('__blocked_') || occupant.id.startsWith('__break_')) {
          if (blockPositions.length === 0) return makeSpaceForWalkIn(pos + 1, isExistingWalkIn);
          continue;
        }
        blockPositions.push(pos);
      }
    }

    if (blockPositions.length === 0) return { position: candidatePosition, shifts: [] };

    const tailPosition = blockPositions[blockPositions.length - 1];
    let emptyPosition = findFirstEmptyPosition(tailPosition + 1);
    if (emptyPosition === -1) return { position: -1, shifts: [] };

    const shifts: AdvanceShift[] = [];
    for (let index = blockPositions.length - 1; index >= 0; index -= 1) {
      const fromPosition = blockPositions[index];
      const occupant = occupancy[fromPosition];
      if (!occupant || occupant.type !== 'A') continue;

      if (emptyPosition <= fromPosition) {
        emptyPosition = findFirstEmptyPosition(fromPosition + 1);
        if (emptyPosition === -1) return { position: -1, shifts: [] };
      }

      occupancy[fromPosition] = null;
      occupancy[emptyPosition] = { type: 'A', id: occupant.id };
      shifts.push({ id: occupant.id, position: emptyPosition });
      emptyPosition = fromPosition;
    }

    shifts.reverse();
    return { position: candidatePosition, shifts };
  };

  for (const candidate of sortedWalkIns) {
    let assignedPosition: number | null = null;
    const preferredPosition = preferredPositions.get(candidate.id);

    const anchorPosition = getLastWalkInPosition();
    const advanceAfterAnchor = countAdvanceAfter(anchorPosition);
    const earliestWindowPosition = findEarliestWindowEmptyPosition();
    const preferredThreshold = typeof preferredPosition === 'number' ? preferredPosition : Number.POSITIVE_INFINITY;

    if (earliestWindowPosition !== -1 && earliestWindowPosition < preferredThreshold) {
      const prepared = makeSpaceForWalkIn(earliestWindowPosition, true);
      if (prepared.position !== -1) {
        prepared.shifts.forEach(shift => applyAssignment(shift.id, shift.position));
        occupancy[prepared.position] = { type: 'W', id: candidate.id };
        applyAssignment(candidate.id, prepared.position);
        continue;
      }
    }

    if (typeof preferredPosition === 'number') {
      const sequentialPosition = findFirstEmptyPosition(anchorPosition + 1);
      if (sequentialPosition !== -1 && sequentialPosition < preferredPosition) {
        const prepared = makeSpaceForWalkIn(sequentialPosition, true);
        if (prepared.position !== -1) {
            prepared.shifts.forEach(shift => applyAssignment(shift.id, shift.position));
            occupancy[prepared.position] = { type: 'W', id: candidate.id };
            applyAssignment(candidate.id, prepared.position);
            continue;
        }
      }
    }

    if (typeof preferredPosition === 'number') {
      const prepared = makeSpaceForWalkIn(preferredPosition, true);
      if (prepared.position !== -1) {
        prepared.shifts.forEach(shift => applyAssignment(shift.id, shift.position));
        occupancy[prepared.position] = { type: 'W', id: candidate.id };
        applyAssignment(candidate.id, prepared.position);
        continue;
      }
    }

    let spacingTargetPosition = -1;
    const hasAdvanceAppointments = advanceAfterAnchor > 0;
    const isSpacingActive = hasAdvanceAppointments && spacing > 0 && advanceAfterAnchor >= spacing;

    if (isSpacingActive) {
      const nthAdvancePosition = findNthAdvanceAfter(anchorPosition, spacing);
      if (nthAdvancePosition !== -1) spacingTargetPosition = nthAdvancePosition + 1;
    } else if (hasAdvanceAppointments) {
      const lastAdvancePosition = findLastAdvanceAfter(anchorPosition);
      if (lastAdvancePosition !== -1) spacingTargetPosition = lastAdvancePosition + 1;
    }

    for (let pos = effectiveFirstFuturePosition; pos < positionCount; pos += 1) {
      if (spacingTargetPosition !== -1 && pos > spacingTargetPosition) break;
      const slotMeta = orderedSlots[pos];
      if (isBefore(slotMeta.time, now)) continue;
      if (occupancy[pos] === null) {
        assignedPosition = pos;
        break;
      }
    }

    if (assignedPosition === null) {
      let targetPosition = spacingTargetPosition;
      if (targetPosition === -1) targetPosition = findFirstEmptyPosition(effectiveFirstFuturePosition);
      if (targetPosition === -1 && effectiveFirstFuturePosition === 0 && occupancy[0] === null) targetPosition = 0;

      const prepared = makeSpaceForWalkIn(targetPosition === -1 ? effectiveFirstFuturePosition : targetPosition, false);
      if (prepared.position !== -1) {
        prepared.shifts.forEach(shift => applyAssignment(shift.id, shift.position));
        assignedPosition = prepared.position;
      }
    }

    if (assignedPosition === null) {
      const anyEmptyFutureSlot = findFirstEmptyPosition(effectiveFirstFuturePosition);
      if (anyEmptyFutureSlot !== -1) assignedPosition = anyEmptyFutureSlot;
    }

    if (assignedPosition === null) throw new Error('No walk-in slots are available.');

    occupancy[assignedPosition] = { type: 'W', id: candidate.id };
    applyAssignment(candidate.id, assignedPosition);
  }

  occupancy.forEach((occupant, position) => {
    if (occupant && occupant.type === 'A' && !assignments.has(occupant.id)) {
      const slotMeta = orderedSlots[position];
      if (slotMeta) {
        assignments.set(occupant.id, {
          id: occupant.id,
          slotIndex: slotMeta.index,
          sessionIndex: slotMeta.sessionIndex,
          slotTime: slotMeta.time,
        });
      }
    }
  });

  overflowAdvance.forEach(item => {
    if (!assignments.has(item.id) && item.sourcePosition !== -1) {
      const slotMeta = orderedSlots[item.sourcePosition];
      if (slotMeta) {
        assignments.set(item.id, {
          id: item.id,
          slotIndex: slotMeta.index,
          sessionIndex: slotMeta.sessionIndex,
          slotTime: slotMeta.time,
        });
      }
    }
  });

  return {
    assignments: Array.from(assignments.values()),
  };
}
