// org/santayn/reservation/service/BookingService.java
package org.santayn.reservation.service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
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
    private final AuthTeacherService auth; // сервис текущего пользователя

    // ===== базовые методы (для админки/совместимости) =====

    @Transactional
    public Booking create(Booking booking) {
        return bookingRepository.save(booking);
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

    @Transactional(readOnly = true)
    public Optional<Booking> getById(Long id) {
        return bookingRepository.findById(id);
    }

    @Transactional(readOnly = true)
    public List<Booking> getAll() {
        return bookingRepository.findAll();
    }

    /** Поиск по БД со строгой чётностью. */
    @Transactional(readOnly = true)
    public List<Booking> search(DayOfWeek dayOfWeek,
                                WeekParityType weekParityType,
                                Long slotId,
                                Long classroomId) {
        return bookingRepository.search(dayOfWeek, weekParityType, slotId, classroomId);
    }

    @Transactional(readOnly = true)
    public List<Booking> searchByTeacher(Long teacherId,
                                         DayOfWeek dayOfWeek,
                                         WeekParityType weekParityType,
                                         Long slotId,
                                         Long classroomId) {
        return bookingRepository.searchByTeacher(teacherId, dayOfWeek, weekParityType, slotId, classroomId);
    }

    // ===== Операции от имени текущего пользователя =====

    /**
     * Создание брони текущим пользователем.
     * - Преподаватель: только если окно свободно; teacherId подменяется на id пользователя,
     *   требуется разовая дата и рассчитанный expiresAt.
     * - Админ: без ограничений; постоянная бронь (bookingDate/expiresAt = null).
     */
    @Transactional
    public Booking createAsCurrentUser(Booking draft, LocalDate bookingDate, Instant expiresAt) {
        var me = auth.currentUser(); // должен возвращать org.santayn.reservation.models.user.User
        boolean isAdmin = me.isAdmin();

        if (!isAdmin) {
            if (bookingDate == null || expiresAt == null) {
                throw new IllegalArgumentException("Для разовой брони преподавателя требуются date и expiresAt.");
            }
            long cnt = bookingRepository.countInWindow(
                    draft.getClassroomId(),
                    draft.getDayOfWeek(),
                    draft.getWeekParityType(),
                    draft.getSlotId(),
                    bookingDate
            );
            if (cnt > 0) {
                throw new IllegalStateException("Окно занято. Бронь невозможна.");
            }
            draft.setTeacherId(me.getId());
            draft.setBookingDate(bookingDate);
            draft.setExpiresAt(expiresAt);
            draft.setCreatedByAdmin(false);
        } else {
            draft.setBookingDate(null);
            draft.setExpiresAt(null);
            draft.setCreatedByAdmin(true);
        }

        draft.setCreatedByUserId(me.getId());
        return bookingRepository.save(draft);
    }

    /** Обновление с учётом прав. */
    @Transactional
    public Booking updateAsCurrentUser(Long id, Booking updated) {
        var me = auth.currentUser();
        var existing = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + id));

        if (!me.isAdmin() && existing.isCreatedByAdmin()) {
            throw new IllegalStateException("Недостаточно прав: запись создана админом.");
        }
        if (!me.isAdmin() && !Objects.equals(existing.getCreatedByUserId(), me.getId())) {
            throw new IllegalStateException("Недостаточно прав: чужая бронь.");
        }

        existing.setDayOfWeek(updated.getDayOfWeek());
        existing.setFloor(updated.getFloor());
        existing.setWeekParityType(updated.getWeekParityType());
        existing.setSlotId(updated.getSlotId());
        existing.setClassroomId(updated.getClassroomId());
        existing.setGroupId(updated.getGroupId());

        if (me.isAdmin()) {
            existing.setTeacherId(updated.getTeacherId());
        }

        return bookingRepository.save(existing);
    }

    /** Удаление с учётом прав. */
    @Transactional
    public void deleteAsCurrentUser(Long id) {
        var me = auth.currentUser();
        var b = bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found: " + id));

        if (!me.isAdmin() && b.isCreatedByAdmin()) {
            throw new IllegalStateException("Недостаточно прав: занятие админа.");
        }
        if (!me.isAdmin() && !Objects.equals(b.getCreatedByUserId(), me.getId())) {
            throw new IllegalStateException("Недостаточно прав: чужая бронь.");
        }
        bookingRepository.delete(b);
    }

    /** Сервисная чистка просроченных разовых броней. */
    @Transactional
    public int cleanupExpired() {
        // ВНИМАНИЕ: репозиторий теперь сам сравнивает с NOW() в БД и не принимает параметров
        return bookingRepository.deleteExpired();
    }
}
