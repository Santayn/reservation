// org/santayn/reservation/web/controller/rest/BookingRestController.java
package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.*;
import java.util.List;
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
 * ВАЖНО: для разовой брони преподавателя клиент присылает поле date (LocalDate, yyyy-MM-dd).
 * Контроллер высчитывает expiresAt по окончанию слота в зоне Europe/Berlin.
 */
@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private final BookingService service;
    private final AuthTeacherService authTeacherService;
    private final ScheduleSlotRepository scheduleSlotRepository;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r) {
        Booking draft = toEntity(r);

        // По дате из UI строим момент окончания в конце выбранного слота
        Instant expiresAt = null;
        if (r.getDate() != null) {
            ScheduleSlot slot = scheduleSlotRepository.findById(r.getSlotId())
                    .orElseThrow(() -> new IllegalArgumentException("Слот не найден: " + r.getSlotId()));

            // ScheduleSlot.getEndAt() -> LocalDateTime: берём только время конца
            LocalTime endTime = slot.getEndAt().toLocalTime();

            // дата (из UI) + время конца слота -> Instant в TZ
            LocalDateTime endDateTime = LocalDateTime.of(r.getDate(), endTime);
            ZoneId zone = ZoneId.of("Europe/Berlin"); // при необходимости поменяйте
            expiresAt = endDateTime.atZone(zone).toInstant();
        }

        Booking created = service.createAsCurrentUser(draft, r.getDate(), expiresAt);
        return ResponseEntity.created(URI.create("/api/bookings/" + created.getId()))
                .body(toResponse(created));
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getAll() {
        List<BookingResponse> list = service.getAll().stream().map(this::toResponse).collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getById(@PathVariable Long id) {
        return service.getById(id)
                .map(b -> ResponseEntity.ok(toResponse(b)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> update(@PathVariable Long id, @Valid @RequestBody BookingCreateRequest r) {
        Booking updated = service.updateAsCurrentUser(id, toEntity(r));
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.deleteAsCurrentUser(id);
        return ResponseEntity.noContent().build();
    }

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
                .teacherId(r.getTeacherId()) // у препода подменяется на его ID
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

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> bad(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> conflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }
}
