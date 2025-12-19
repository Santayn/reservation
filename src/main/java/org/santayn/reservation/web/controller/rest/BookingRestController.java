package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.ScheduleSlot;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.repositories.ClassroomRepository;
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
 * Контроллер бронирований (вариант 2):
 *
 * Фронт НЕ отправляет classroomId.
 * Фронт отправляет classroomName (например "Ауд. 101").
 *
 * Контроллер сам находит реальный classroomId в БД по имени аудитории
 * через ClassroomRepository, и уже с этим id вызывает сервис.
 */
@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private static final ZoneOffset DEFAULT_OFFSET = ZoneOffset.ofHours(3); // Москва = UTC+03:00

    private final BookingService service;
    private final AuthTeacherService authTeacherService;
    private final ScheduleSlotRepository scheduleSlotRepository;
    private final ClassroomRepository classroomRepository;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r) {
        // 1. Определяем целевую аудиторию
        Long resolvedClassroomId = resolveClassroomIdByName(r.getClassroomName());

        // 2. Собираем draft Booking (ещё без обработки прав)
        Booking draft = toEntity(r, resolvedClassroomId);

        // 3. Считаем expiresAt, если есть date (разовая бронь)
        Instant expiresAt = null;
        if (r.getDate() != null) {
            ScheduleSlot slot = scheduleSlotRepository.findById(r.getSlotId())
                    .orElseThrow(() -> new IllegalArgumentException("Слот не найден: " + r.getSlotId()));

            LocalTime endTime = slot.getEndAt().toLocalTime(); // конец пары (локальное расписание)
            LocalDateTime endDateTime = LocalDateTime.of(r.getDate(), endTime);

            ZoneOffset offset = resolveFixedOffset(r.getTimeZoneId());
            expiresAt = endDateTime.atOffset(offset).toInstant();
        }

        // 4. Создаём с учётом прав текущего пользователя
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
        // так же, как при создании: по имени вытягиваем classroomId
        Long resolvedClassroomId = resolveClassroomIdByName(r.getClassroomName());
        Booking updatedBooking = toEntity(r, resolvedClassroomId);

        Booking updated = service.updateAsCurrentUser(id, updatedBooking);
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteAsCurrentUser(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Поиск броней по дню/чётности/слоту/аудитории.
     *
     * ВНИМАНИЕ по параметрам:
     *  - dayOfWeek обязателен
     *  - weekParityType обязателен
     *  - slotId обязателен
     *  - classroomId обязателен (т.к. фронт реально хочет знать занятость конкретной аудитории)
     *
     * slim=true => возвращаем урезанный ответ, иначе подробный.
     */
    @GetMapping("/search")
    public ResponseEntity<List<?>> search(
            @RequestParam DayOfWeek dayOfWeek,
            @RequestParam WeekParityType weekParityType,
            @RequestParam Long slotId,
            @RequestParam Long classroomId,
            @RequestParam(required = false, defaultValue = "false") boolean slim
    ) {
        List<Booking> filtered = service.search(dayOfWeek, weekParityType, slotId, classroomId);

        if (slim) {
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

    /**
     * Расписание для текущего авторизованного преподавателя.
     * Админ не является преподавателем => вернётся 409.
     */
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

    // ====== Маппинг DTO -> Entity ======

    private Booking toEntity(BookingCreateRequest r, Long resolvedClassroomId) {
        return Booking.builder()
                .dayOfWeek(r.getDayOfWeek())
                .floor(r.getFloor())
                .weekParityType(r.getWeekParityType())
                .slotId(r.getSlotId())
                .classroomId(resolvedClassroomId)
                .groupId(r.getGroupId())
                // teacherId может быть перетёрт сервисом, если не админ
                .teacherId(r.getTeacherId())
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

    /**
     * Урезанный ответ — для быстрой отрисовки занятости.
     */
    public record BookingSlimResponse(Long id, Long classroomId, Long groupId, Integer floor) {
        public static BookingSlimResponse from(Booking b) {
            return new BookingSlimResponse(
                    b.getId(),
                    b.getClassroomId(),
                    b.getGroupId(),
                    b.getFloor()
            );
        }
    }

    // ======= Работа с аудиторией по имени =======

    /**
     * Вариант 2: получаем только имя аудитории.
     * Пример: "Ауд. 101".
     * По нему ищем Classroom в БД.
     */
    private Long resolveClassroomIdByName(String classroomName) {
        if (classroomName == null || classroomName.isBlank()) {
            throw new IllegalArgumentException(
                    "Не указано имя аудитории (classroomName)."
            );
        }

        return classroomRepository.findByNameIgnoreCase(classroomName.trim())
                .map(c -> c.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Аудитория \"" + classroomName + "\" не найдена в системе. " +
                                "Сначала нужно завести её в справочнике аудиторий."
                ));
    }

    // ======= Разбор timeZoneId в фиксированное смещение UTC =======

    private static final Map<String, ZoneOffset> NAME_TO_OFFSET = buildNameMap();

    private static Map<String, ZoneOffset> buildNameMap() {
        Map<String, ZoneOffset> m = new HashMap<>();
        // Москва (фикс +03)
        m.put("europe/moscow", ZoneOffset.ofHours(3));
        m.put("moscow",        ZoneOffset.ofHours(3));
        m.put("msk",           ZoneOffset.ofHours(3));
        // Лондон (фикс 0, без DST)
        m.put("europe/london", ZoneOffset.UTC);
        m.put("london",        ZoneOffset.UTC);
        m.put("gmt",           ZoneOffset.UTC);
        m.put("uk",            ZoneOffset.UTC);
        // Берлин (жёстко +01 без DST, если надо)
        m.put("europe/berlin", ZoneOffset.ofHours(1));
        m.put("berlin",        ZoneOffset.ofHours(1));
        return m;
    }

    private ZoneOffset resolveFixedOffset(String tz) {
        if (tz == null || tz.isBlank()) {
            return DEFAULT_OFFSET;
        }
        String v = tz.trim();

        // 1) "UTC+03:00", "UTC-10", "UTC+00"
        String upper = v.toUpperCase();
        if (upper.startsWith("UTC")) {
            String raw = upper.substring(3).trim();
            if (!raw.isEmpty()) {
                String norm = normalizeOffset(raw);
                try {
                    return ZoneOffset.of(norm);
                } catch (Exception ignored) {
                }
            }
        }

        // 2) по имени в таблице
        ZoneOffset byName = NAME_TO_OFFSET.get(v.toLowerCase());
        if (byName != null) {
            return byName;
        }

        // 3) возможно просто "+03:00" / "-10"
        try {
            return ZoneOffset.of(normalizeOffset(v));
        } catch (Exception ignored) {
        }

        // 4) дефолт — Москва
        return DEFAULT_OFFSET;
    }

    /**
     * "+3" -> "+03:00"
     * "+03" -> "+03:00"
     * "+0300" -> "+03:00"
     * "-10" -> "-10:00"
     * "+03:00" -> "+03:00" (без изменений)
     */
    private String normalizeOffset(String raw) {
        String s = raw.replace(" ", "");
        if (!s.contains(":")) {
            boolean neg = s.startsWith("-");
            boolean pos = s.startsWith("+");
            String digits = s.replace("+", "").replace("-", "");
            if (digits.length() == 1) digits = "0" + digits;
            if (digits.length() == 2) digits = digits + "00";
            if (digits.length() == 3) digits = "0" + digits;
            String hh = digits.substring(0, 2);
            String mm = digits.substring(2, 4);
            return (neg ? "-" : "+") + hh + ":" + mm;
        }
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
