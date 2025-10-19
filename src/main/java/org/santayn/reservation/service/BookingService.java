package org.santayn.reservation.service;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.repositories.BookingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepository;

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
        existing.setSlotId(updated.getSlotId());
        existing.setClassroomId(updated.getClassroomId());
        existing.setGroupId(updated.getGroupId());
        existing.setTeacherId(updated.getTeacherId());
        return bookingRepository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        bookingRepository.deleteById(id);
    }

    /** Поиск по БД со строгой чётностью (EVEN/ODD — только они; ANY — только ANY). */
    @Transactional(readOnly = true)
    public List<Booking> search(DayOfWeek dayOfWeek,
                                WeekParityType weekParityType,
                                Long slotId,
                                Long classroomId) {
        return bookingRepository.search(dayOfWeek, weekParityType, slotId, classroomId);
    }
    // === НОВОЕ ===
    @Transactional(readOnly = true)
    public List<Booking> searchByTeacher(Long teacherId,
                                         DayOfWeek dayOfWeek,
                                         WeekParityType weekParityType,
                                         Long slotId,
                                         Long classroomId) {
        return bookingRepository.searchByTeacher(teacherId, dayOfWeek, weekParityType, slotId, classroomId);
    }
}
