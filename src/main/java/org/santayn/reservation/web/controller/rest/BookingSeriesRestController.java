package org.santayn.reservation.web.controller.rest;

import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.santayn.reservation.models.booking.BookingSeries;
import org.santayn.reservation.service.BookingSeriesService;
import org.santayn.reservation.web.dto.booking.BookingSeriesCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingSeriesDto;
import org.santayn.reservation.web.dto.booking.BookingSeriesUpdateRequest;
import org.santayn.reservation.web.exception.NotFoundException;

import java.time.OffsetDateTime;

@Slf4j
@RestController
@RequestMapping(value = "/api/booking-series", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingSeriesRestController {

    private final BookingSeriesService service;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingSeriesDto> create(@Valid @RequestBody BookingSeriesCreateRequest req) {
        log.info("CREATE series req: classroomId={}, groupId={}, tz={}, floor={}, day={}, scheduleType={}, weekType={}",
                req.classroomId(), req.groupId(), req.timezone(), req.floor(), req.dayOfWeek(), req.scheduleType(), req.weekType());
        BookingSeriesDto resp = service.create(req);
        log.info("CREATE series resp: id={}, payload={}", resp.id(), resp);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingSeriesDto> get(@PathVariable Long id) {
        log.info("GET series id={}", id);
        BookingSeriesDto dto = service.get(id);
        log.info("GET series resp: {}", dto);
        return ResponseEntity.ok(dto);
    }

    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingSeriesDto> update(@PathVariable Long id,
                                                   @Valid @RequestBody BookingSeriesUpdateRequest req) {
        log.info("UPDATE series id={}, req={}", id, req);
        BookingSeriesDto dto = service.update(id, req);
        log.info("UPDATE series resp: {}", dto);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        log.info("DELETE series id={}", id);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<Page<BookingSeriesDto>> search(
            @RequestParam(required = false) Long classroomId,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) String timezone,
            @RequestParam(required = false) Integer floor,
            @RequestParam(required = false) Integer dayOfWeek,
            @RequestParam(required = false) BookingSeries.ScheduleType scheduleType,
            @RequestParam(required = false) BookingSeries.WeekType weekType,
            @RequestParam(required = false) OffsetDateTime createdFrom,
            @RequestParam(required = false) OffsetDateTime createdTo,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        log.info("SEARCH series filters: classroomId={}, groupId={}, tz={}, floor={}, day={}, type={}, weekType={}, from={}, to={}",
                classroomId, groupId, timezone, floor, dayOfWeek, scheduleType, weekType, createdFrom, createdTo);
        Page<BookingSeriesDto> page = service.search(
                classroomId, groupId, timezone, floor, dayOfWeek, scheduleType, weekType, createdFrom, createdTo, pageable
        );
        log.info("SEARCH series resp: total={}", page.getTotalElements());
        return ResponseEntity.ok(page);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<String> handleNotFound(NotFoundException ex) {
        log.warn("NotFound: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<String> handleEntityNotFound(EntityNotFoundException ex) {
        log.warn("EntityNotFound: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException ex) {
        log.warn("Conflict: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
        log.warn("BadRequest: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }
}
