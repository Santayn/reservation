package org.santayn.reservation.service;

import java.util.List;
import java.util.Optional;
import org.santayn.reservation.models.booking.Booking;

import org.santayn.reservation.repositories.BookingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;

    public BookingService(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    @Transactional
    public Booking create(Booking booking) {
        return bookingRepository.save(booking);
    }

    @Transactional(readOnly = true)
    public Optional<Booking> getById(Long id) {
        return bookingRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Booking> getAll() {
        return bookingRepository.findAll();
    }

    @Transactional
    public Booking update(Long id, Booking updated) {
        Booking existing = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + id));

        existing.setDayOfWeek(updated.getDayOfWeek());
        existing.setFloor(updated.getFloor());
        existing.setWeekParityType(updated.getWeekParityType());
        existing.setTimeZoneId(updated.getTimeZoneId());
        existing.setClassroomId(updated.getClassroomId());
        existing.setGroupId(updated.getGroupId());
        return bookingRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        bookingRepository.deleteById(id);
    }
}
