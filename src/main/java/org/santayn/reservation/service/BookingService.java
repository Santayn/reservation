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

/**
 * Сервис для управления бронированиями аудиторий.
 * Вариант 2 (через имя аудитории):
 *  - Контроллер уже обязан передать корректный classroomId,
 *    найденный по имени аудитории. Сервису приходит уже готовый Booking.
 */
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
        existing.setBookingDate(updated.getBookingDate());
        existing.setExpiresAt(updated.getExpiresAt());
        existing.setCreatedByAdmin(updated.isCreatedByAdmin());
        existing.setCreatedByUserId(updated.getCreatedByUserId());

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
                                Long classroomId,
                                LocalDate date) {
        return bookingRepository.search(dayOfWeek, parityTypesForDisplay(weekParityType), slotId, classroomId, date);
    }

    @Transactional(readOnly = true)
    public List<Booking> searchByTeacher(Long teacherId,
                                         DayOfWeek dayOfWeek,
                                         WeekParityType weekParityType,
                                         Long slotId,
                                         Long classroomId) {
        return bookingRepository.searchByTeacher(
                teacherId,
                dayOfWeek,
                parityTypesForDisplay(weekParityType),
                slotId,
                classroomId
        );
    }

    @Transactional(readOnly = true)
    public List<Booking> searchByGroup(Long groupId,
                                       DayOfWeek dayOfWeek,
                                       WeekParityType weekParityType,
                                       Long slotId,
                                       Long classroomId) {
        return bookingRepository.searchByGroup(
                groupId,
                dayOfWeek,
                parityTypesForDisplay(weekParityType),
                slotId,
                classroomId
        );
    }

    private List<WeekParityType> parityTypesForDisplay(WeekParityType weekParityType) {
        if (weekParityType == null) {
            return List.of(WeekParityType.ANY, WeekParityType.EVEN, WeekParityType.ODD);
        }
        return List.of(weekParityType);
    }

    // ===== Операции от имени текущего пользователя =====

    /**
     * Создание брони текущим пользователем.
     *
     * - Преподаватель:
     *   * можно только если окно свободно
     *   * teacherId насильно ставится = текущий пользователь
     *   * требуется разовая дата и рассчитанный expiresAt
     *
     * - Админ:
     *   * может без ограничений
     *   * постоянная бронь (bookingDate/expiresAt = null)
     *
     * Параметр booking уже должен содержать booking.classroomId,
     * найденный по имени аудитории на контроллере (вариант 2).
     */
    @Transactional
    public Booking createAsCurrentUser(Booking booking, LocalDate bookingDate, Instant expiresAt) {
        var me = auth.currentUser(); // возвращает текущего пользователя (User)
        boolean isAdmin = me.isAdmin();

        if (!isAdmin) {
            if (bookingDate == null || expiresAt == null) {
                throw new IllegalArgumentException("Для разовой брони преподавателя требуются date и expiresAt.");
            }

            long cnt = bookingRepository.countGroupInWindow(
                    booking.getGroupId(),
                    booking.getDayOfWeek(),
                    booking.getWeekParityType(),
                    booking.getSlotId(),
                    bookingDate
            );
            if (cnt > 0) {
                throw new IllegalStateException("Группа уже занята в этот день и слот.");
            }

            booking.setTeacherId(me.getId());
            booking.setBookingDate(bookingDate);
            booking.setExpiresAt(expiresAt);
            booking.setCreatedByAdmin(false);
        } else {
            booking.setBookingDate(null);
            booking.setExpiresAt(null);
            booking.setCreatedByAdmin(true);
        }

        booking.setCreatedByUserId(me.getId());
        return bookingRepository.save(booking);
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
        return bookingRepository.deleteExpired();
    }
}
