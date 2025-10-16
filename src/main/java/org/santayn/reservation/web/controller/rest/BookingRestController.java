package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import java.net.URI;
import java.time.DayOfWeek;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.service.BookingService;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST-контроллер для упрощённой модели Booking.
 *
 * Эндпоинты:
 *  - POST   /api/bookings                — создать бронь
 *  - GET    /api/bookings                — список всех броней
 *  - GET    /api/bookings/{id}           — получить по id
 *  - PUT    /api/bookings/{id}           — обновить по id
 *  - DELETE /api/bookings/{id}           — удалить по id
 *  - GET    /api/bookings/search         — найти по classroomId + dayOfWeek + weekParityType
 */
@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private final BookingService service;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r) {
        Booking created = service.create(toEntity(r));
        BookingResponse resp = toResponse(created);
        return ResponseEntity
                .created(URI.create("/api/bookings/" + resp.getId()))
                .body(resp);
    }

    @GetMapping
    public ResponseEntity<List<BookingResponse>> getAll() {
        List<BookingResponse> list = service.getAll()
                .stream()
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
        Booking updated = service.update(id, toEntity(r));
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteById(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Поиск броней по аудитории + дню недели + типу недели.
     * Пример: /api/bookings/search?classroomId=10&dayOfWeek=MONDAY&weekParityType=ANY
     */
    @GetMapping("/search")
    public ResponseEntity<List<BookingResponse>> search(
            @RequestParam Long classroomId,
            @RequestParam DayOfWeek dayOfWeek,
            @RequestParam WeekParityType weekParityType
    ) {
        List<BookingResponse> list = service
                .getAll() // простой вариант: если нужен прямой репозиториный метод — добавьте в сервис
                .stream()
                .filter(b -> b.getClassroomId().equals(classroomId))
                .filter(b -> b.getDayOfWeek() == dayOfWeek)
                .filter(b -> b.getWeekParityType() == weekParityType)
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(list);
    }

    // ------------------------------------------------------------------------------------------------

    private Booking toEntity(BookingCreateRequest r) {
        return Booking.builder()
                .dayOfWeek(r.getDayOfWeek())
                .floor(r.getFloor())
                .weekParityType(r.getWeekParityType())
                .timeZoneId(r.getTimeZoneId())
                .classroomId(r.getClassroomId())
                .groupId(r.getGroupId())
                .build();
    }

    private BookingResponse toResponse(Booking b) {
        return new BookingResponse(
                b.getId(),
                b.getDayOfWeek(),
                b.getFloor(),
                b.getWeekParityType(),
                b.getTimeZoneId(),
                b.getClassroomId(),
                b.getGroupId()
        );
    }

    // Локальные обработчики ошибок — базовые варианты

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }
}
