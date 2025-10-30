// org/santayn/reservation/web/controller/rest/BookingRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.*;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.ScheduleSlot;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.repositories.ScheduleSlotRepository;
import org.santayn.reservation.service.AuthTeacherService;
import org.santayn.reservation.service.BookingService;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Разовая бронь:
 * - Клиент присылает date (yyyy-MM-dd) и timeZoneId.
 * - timeZoneId может быть:
 *     * "UTC+03:00", "UTC-10", "UTC+00" (предпочтительно)
 *     * либо "Europe/Moscow", "Moscow", "Europe/London", "London" и т.п.
 * - Контроллер переводит это в фиксированный ZoneOffset (без DST) и
 *   вычисляет expiresAt = (date + время конца слота) в этом смещении -> Instant.
 * - В БД храним только Instant expiresAt. Саму строку TZ не сохраняем.
 */
@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private static final ZoneOffset DEFAULT_OFFSET = ZoneOffset.ofHours(3); // Москва = UTC+03:00

    private final BookingService service;
    private final AuthTeacherService authTeacherService;
    private final ScheduleSlotRepository scheduleSlotRepository;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r) {
        Booking draft = toEntity(r);

        Instant expiresAt = null;
        if (r.getDate() != null) {
            ScheduleSlot slot = scheduleSlotRepository.findById(r.getSlotId())
                    .orElseThrow(() -> new IllegalArgumentException("Слот не найден: " + r.getSlotId()));

            // Берём только время конца слота (локальная «школьная» логика)
            LocalTime endTime = slot.getEndAt().toLocalTime();

            // Дата из UI + это время
            LocalDateTime endDateTime = LocalDateTime.of(r.getDate(), endTime);

            // Фиксированное смещение (без DST)
            ZoneOffset offset = resolveFixedOffset(r.getTimeZoneId());

            // Превращаем в Instant через OffsetDateTime
            expiresAt = endDateTime.atOffset(offset).toInstant();
        }

        Booking created = service.createAsCurrentUser(draft, r.getDate(), expiresAt);
        return ResponseEntity
                .created(URI.create("/api/bookings/" + created.getId()))
                .body(toResponse(created));
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getAll() {
        List<BookingResponse> list = service.getAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getById(@PathVariable Long id) {
        return service.getById(id)
                .map(b -> ResponseEntity.ok(toResponse(b)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> update(@PathVariable Long id,
                                                  @Valid @RequestBody BookingCreateRequest r) {
        Booking updated = service.updateAsCurrentUser(id, toEntity(r));
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteAsCurrentUser(id);
        return ResponseEntity.noContent().build();
    }

    /** Поиск броней по дню/чётности/слоту (агрегированный/полный ответ). */
    @GetMapping("/search")
    public ResponseEntity<List<?>> search(
            @RequestParam DayOfWeek dayOfWeek,
            @RequestParam WeekParityType weekParityType,
            @RequestParam Long slotId,
            @RequestParam(required = false) Long classroomId,
            @RequestParam(required = false, defaultValue = "false") boolean slim
    ) {
        List<Booking> filtered = service.search(dayOfWeek, weekParityType, slotId, classroomId);

        boolean returnSlim = slim || classroomId == null;
        if (returnSlim) {
            List<BookingSlimResponse> body = filtered.stream()
                    .map(BookingSlimResponse::from)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(body);
        } else {
            List<BookingResponse> body = filtered.stream()
                    .map(this::toResponse)
                    .collect(Collectors.toList());
            return ResponseEntity.ok(body);
        }
    }

    /** Расписание для текущего авторизованного преподавателя. */
    @GetMapping("/my")
    public ResponseEntity<List<BookingResponse>> mySchedule(
            @RequestParam(required = false) DayOfWeek dayOfWeek,
            @RequestParam(required = false) WeekParityType weekParityType,
            @RequestParam(required = false) Long slotId,
            @RequestParam(required = false) Long classroomId
    ) {
        Long teacherId = authTeacherService.currentTeacherId();
        List<Booking> list = service.searchByTeacher(teacherId, dayOfWeek, weekParityType, slotId, classroomId);
        List<BookingResponse> body = list.stream().map(this::toResponse).toList();
        return ResponseEntity.ok(body);
    }

    private Booking toEntity(BookingCreateRequest r) {
        return Booking.builder()
                .dayOfWeek(r.getDayOfWeek())
                .floor(r.getFloor())
                .weekParityType(r.getWeekParityType())
                .slotId(r.getSlotId())
                .classroomId(r.getClassroomId())
                .groupId(r.getGroupId())
                .teacherId(r.getTeacherId()) // у препода будет подменено на его ID
                .build();
    }

    private BookingResponse toResponse(Booking b) {
        return new BookingResponse(
                b.getId(),
                b.getDayOfWeek(),
                b.getFloor(),
                b.getWeekParityType(),
                b.getSlotId(),
                b.getClassroomId(),
                b.getGroupId(),
                b.getTeacherId()
        );
    }

    /** Облегчённый ответ для агрегированных запросов. */
    public record BookingSlimResponse(Long id, Long classroomId, Long groupId, Integer floor) {
        public static BookingSlimResponse from(Booking b) {
            return new BookingSlimResponse(b.getId(), b.getClassroomId(), b.getGroupId(), b.getFloor());
        }
    }

    // ======= Разбор timeZoneId в фиксированное смещение UTC =======

    private static final Map<String, ZoneOffset> NAME_TO_OFFSET = buildNameMap();

    private static Map<String, ZoneOffset> buildNameMap() {
        Map<String, ZoneOffset> m = new HashMap<>();
        // Москва
        m.put("europe/moscow", ZoneOffset.ofHours(3));
        m.put("moscow",        ZoneOffset.ofHours(3));
        m.put("msk",           ZoneOffset.ofHours(3));
        // Лондон (всегда 0, без DST)
        m.put("europe/london", ZoneOffset.UTC);
        m.put("london",        ZoneOffset.UTC);
        m.put("gmt",           ZoneOffset.UTC);
        m.put("uk",            ZoneOffset.UTC);
        // Берлин (жёстко +01, без DST) — если надо
        m.put("europe/berlin", ZoneOffset.ofHours(1));
        m.put("berlin",        ZoneOffset.ofHours(1));
        // Добавляйте при необходимости
        return m;
    }

    private ZoneOffset resolveFixedOffset(String tz) {
        if (tz == null || tz.isBlank()) {
            return DEFAULT_OFFSET;
        }
        String v = tz.trim();

        // 1) Нормальная форма: "UTC+03:00", "UTC-10", "UTC+00"
        String upper = v.toUpperCase();
        if (upper.startsWith("UTC")) {
            String raw = upper.substring(3).trim();  // "+03:00" | "-10" | "+00"
            if (!raw.isEmpty()) {
                // Приведём к "+HH:MM"
                String norm = normalizeOffset(raw);
                try {
                    return ZoneOffset.of(norm);
                } catch (Exception ignored) {}
            }
        }

        // 2) Сопоставление по «имени» (жестко забитое смещение, без DST)
        ZoneOffset byName = NAME_TO_OFFSET.get(v.toLowerCase());
        if (byName != null) return byName;

        // 3) Последняя попытка: вдруг пришло просто "+03:00" / "-10"
        try {
            return ZoneOffset.of(normalizeOffset(v));
        } catch (Exception ignored) {}

        // 4) Дефолт — Москва +03:00
        return DEFAULT_OFFSET;
    }

    /** Приводит строку смещения к формату, который понимает ZoneOffset: "+HH:MM". */
    private String normalizeOffset(String raw) {
        String s = raw.replace(" ", "");
        // варианты: "+3", "+03", "+0300", "+03:00", "-10", "-10:30"
        if (!s.contains(":")) {
            // "+3" -> "+03:00"; "+0300" -> "+03:00"; "-10" -> "-10:00"
            boolean neg = s.startsWith("-");
            boolean pos = s.startsWith("+");
            String digits = s.replace("+", "").replace("-", "");
            if (digits.length() == 1) digits = "0" + digits;
            if (digits.length() == 2) digits = digits + "00";
            if (digits.length() == 3) digits = "0" + digits; // теоретически
            String hh = digits.substring(0, 2);
            String mm = digits.substring(2, 4);
            return (neg ? "-" : "+") + hh + ":" + mm;
        }
        // уже "+HH:MM"
        return s;
    }

    // ======= Handlers =======

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> bad(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> conflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }
}
