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

@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private final BookingService service;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r) {
        Booking created = service.create(toEntity(r));
        return ResponseEntity
                .created(URI.create("/api/bookings/" + created.getId()))
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
        Booking updated = service.update(id, toEntity(r));
        return ResponseEntity.ok(toResponse(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Поиск броней по дню/чётности/слоту.
     * classroomId опционален: если не указан — ищем по всем аудиториям.
     *
     * Чётность — СТРОГО:
     *  - ANY  → возвращаем только записи с weekParityType = ANY;
     *  - EVEN → только EVEN;
     *  - ODD  → только ODD.
     *
     * slim:
     *  - slim=true или classroomId=null → облегчённый ответ (BookingSlimResponse);
     *  - иначе — полный BookingResponse.
     */
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

    private Booking toEntity(BookingCreateRequest r) {
        return Booking.builder()
                .dayOfWeek(r.getDayOfWeek())
                .floor(r.getFloor())
                .weekParityType(r.getWeekParityType())
                .slotId(r.getSlotId())
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
                b.getSlotId(),
                b.getClassroomId(),
                b.getGroupId()
        );
    }

    /** Облегчённый ответ для агрегированных запросов. */
    public record BookingSlimResponse(
            Long id,
            Long classroomId,
            Long groupId,
            Integer floor
    ) {
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
