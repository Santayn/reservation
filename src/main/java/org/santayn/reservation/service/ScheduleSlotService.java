package org.santayn.reservation.service;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.schedule.ScheduleSlot;

import org.santayn.reservation.repositories.ScheduleSlotRepository;
import org.santayn.reservation.web.dto.schedule.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleSlotService {

    private final ScheduleSlotRepository repo;

    @Transactional(readOnly = true)
    public List<ScheduleSlot> list() {
        return repo.findAllByOrderByStartAtAsc();
    }

    @Transactional(readOnly = true)
    public ScheduleSlot getOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Slot not found: " + id));
    }

    @Transactional
    public ScheduleSlot create(@Valid ScheduleSlotCreateRequest r) {
        validateBounds(r.getStartAt(), r.getEndAt());
        ensureNoOverlap(r.getStartAt(), r.getEndAt());

        var slot = ScheduleSlot.builder()
                .startAt(r.getStartAt())
                .endAt(r.getEndAt())
                .build();
        return repo.save(slot);
    }

    @Transactional
    public List<ScheduleSlot> createBulk(@Valid ScheduleSlotBulkCreateRequest req) {
        List<ScheduleSlot> result = new ArrayList<>();
        for (var r : req.getSlots()) {
            result.add(create(r));
        }
        return result;
    }

    @Transactional
    public List<ScheduleSlot> generate(@Valid ScheduleSlotGenerateRequest g) {
        var base = g.getBaseDate();
        var start = LocalDateTime.of(base, g.getFirstStart());
        List<ScheduleSlot> created = new ArrayList<>();

        for (int i = 0; i < g.getCount(); i++) {
            var end = start.plusMinutes(g.getLessonMinutes());
            var dto = ScheduleSlotCreateRequest.builder()
                    .startAt(start)
                    .endAt(end)
                    .build();
            created.add(create(dto));
            start = end.plusMinutes(g.getBreakMinutes());
        }
        return created;
    }

    @Transactional
    public ScheduleSlot update(Long id, @Valid ScheduleSlotCreateRequest r) {
        validateBounds(r.getStartAt(), r.getEndAt());
        // при апдейте допустим пересечения только с самим собой -> простейший путь:
        // проверку делаем вручную
        var overlapping = repo.existsOverlapping(r.getStartAt(), r.getEndAt());
        if (overlapping) {
            // чтоб позволить "не изменили интервал" — проверим фактическую запись
            var existing = getOrThrow(id);
            boolean same = existing.getStartAt().equals(r.getStartAt())
                    && existing.getEndAt().equals(r.getEndAt());
            if (!same) throw new IllegalStateException("Interval overlaps other slot(s).");
        }

        var slot = getOrThrow(id);
        slot.setStartAt(r.getStartAt());
        slot.setEndAt(r.getEndAt());
        return repo.save(slot);
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) return;
        repo.deleteById(id);
    }

    // --- helpers ---

    private void validateBounds(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            throw new IllegalArgumentException("startAt and endAt must be provided.");
        }
        if (!end.isAfter(start)) {
            throw new IllegalArgumentException("endAt must be after startAt.");
        }
    }

    private void ensureNoOverlap(LocalDateTime start, LocalDateTime end) {
        if (repo.existsOverlapping(start, end)) {
            throw new IllegalStateException("Interval overlaps existing slot(s).");
        }
    }

    // мапперы в DTO
    public static ScheduleSlotResponse toResp(ScheduleSlot s) {
        return ScheduleSlotResponse.builder()
                .id(s.getId())
                .startAt(s.getStartAt())
                .endAt(s.getEndAt())
                .build();
    }

    public static List<ScheduleSlotResponse> toRespList(List<ScheduleSlot> list) {
        return list.stream().map(ScheduleSlotService::toResp).toList();
    }
}
