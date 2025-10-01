package org.santayn.reservation.web.controller.rest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.service.BookingService;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingDTO;
import org.santayn.reservation.web.dto.faculty.FacultyCreateRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingRestController {
    private final BookingService service;
    @PostMapping("/save")
    public ResponseEntity<BookingDTO> save(@Valid @RequestBody BookingCreateRequest r){
        return ResponseEntity.ok(service.create(r));
    }
}
