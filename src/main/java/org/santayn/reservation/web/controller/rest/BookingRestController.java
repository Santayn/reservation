package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.service.BookingService;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingResponse;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping(value = "/api/bookings", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BookingRestController {

    private final BookingService service;

    /** Создать/обновить бронь на дату+слот+кабинет.
     *  Если в теле есть поля расписания (mode/parity/day), сервис дополнительно сохранит серию. */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<BookingResponse> create(@Valid @RequestBody BookingCreateRequest r,
                                                  Principal principal) {
        var resp = service.create(r, principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    /** Список броней на указанный слот в выбранную дату. */
    @GetMapping("/by-slot")
    public ResponseEntity<List<BookingResponse>> bySlot(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam Long slotId) {
        return ResponseEntity.ok(service.bySlot(date, slotId));
    }

    /** Удаление брони по составному ключу (дата+слот+кабинет). */
    @DeleteMapping("/by-key")
    public ResponseEntity<Void> deleteByKey(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam Long slotId,
            @RequestParam Long classroomId) {
        service.deleteByKey(date, slotId, classroomId);
        return ResponseEntity.noContent().build();
    }

    /** Удаление по ID. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteById(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // -------- локальные хендлеры ошибок (без глобального @ControllerAdvice) --------

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<String> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }

    /** Например, переполнение вместимости аудитории. */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<String> handleConflict(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ex.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
    }
}
