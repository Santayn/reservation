package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.repositories.BookingRepository;
import org.santayn.reservation.repositories.ClassroomRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.repositories.ScheduleSlotRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingResponse;
import org.santayn.reservation.web.dto.booking.GroupShortResponse;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepo;
    private final ScheduleSlotRepository slotRepo;
    private final ClassroomRepository classroomRepo;
    private final GroupRepository groupRepo;
    private final UserRepository userRepo;

    @Transactional
    public BookingResponse create(BookingCreateRequest r, Principal principal) {
        var date = r.date();
        var slot = slotRepo.findById(r.slotId())
                .orElseThrow(() -> new NotFoundException("Slot not found: " + r.slotId()));
        var room = classroomRepo.findById(r.classroomId())
                .orElseThrow(() -> new NotFoundException("Classroom not found: " + r.classroomId()));

        var booking = bookingRepo.findByDateAndSlot_IdAndClassroom_Id(date, r.slotId(), r.classroomId())
                .orElseGet(() -> {
                    var b = new Booking();
                    b.setDate(date);
                    b.setSlot(slot);
                    b.setClassroom(room);
                    b.setCreatedAt(LocalDateTime.now());
                    if (principal != null) {
                        userRepo.findByLogin(principal.getName()).ifPresent(b::setCreatedBy);
                    }
                    return b;
                });

        // r.groupIds() — List<Long>
        var groups = new HashSet<Group>(groupRepo.findAllById(r.groupIds()));
        booking.setGroups(groups);

        booking = bookingRepo.save(booking);
        return toResponse(booking);
    }

    @Transactional(readOnly = true)
    public List<BookingResponse> bySlot(LocalDate date, Long slotId) {
        return bookingRepo.findAllByDateAndSlot_Id(date, slotId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void deleteByKey(LocalDate date, Long slotId, Long classroomId) {
        bookingRepo.findByDateAndSlot_IdAndClassroom_Id(date, slotId, classroomId)
                .ifPresent(bookingRepo::delete);
    }

    @Transactional
    public void deleteById(Long id) {
        bookingRepo.deleteById(id);
    }

    // ---------- helpers ----------

    private BookingResponse toResponse(Booking b) {
        var groups = b.getGroups().stream()
                .map(g -> new GroupShortResponse(
                        g.getId(),
                        safeGroupName(g),
                        sizeOf(g)
                ))
                .toList();

        return new BookingResponse(
                b.getId(),
                b.getClassroom().getId(),
                b.getClassroom().getName(),
                groups,
                bookedBy(b.getCreatedBy()) // <-- было bookedBy(b)
        );
    }

    private String bookedBy(org.santayn.reservation.models.user.User u) {
        if (u == null) return null;

        // если есть getFullName() — используем, иначе login
        try {
            var m = u.getClass().getMethod("getFullName");
            var v = (String) m.invoke(u);
            if (v != null && !v.isBlank()) return v;
        } catch (ReflectiveOperationException ignored) {}

        try {
            var m = u.getClass().getMethod("getLogin");
            return (String) m.invoke(u);
        } catch (ReflectiveOperationException ignored) {}

        return null;
    }

    private String safeGroupName(Group g) {
        try {
            var m = g.getClass().getMethod("getName");
            return (String) m.invoke(g);
        } catch (ReflectiveOperationException e) {
            return "group-" + g.getId();
        }
    }

    /** Берём size из поля 'capacity' или 'size' — что есть. */
    private int sizeOf(Group g) {
        Integer v = getIntField(g, "capacity");
        if (v != null) return v;
        v = getIntField(g, "size");
        return v != null ? v : 0;
    }

    private Integer getIntField(Object o, String field) {
        try {
            Field f = o.getClass().getDeclaredField(field);
            f.setAccessible(true);
            Object v = f.get(o);
            if (v instanceof Number n) return n.intValue();
            return null;
        } catch (NoSuchFieldException | IllegalAccessException e) {
            return null;
        }
    }

    /** Авто-очистка «коротких» броней: всё старше сегодняшнего дня. */
    @Scheduled(cron = "0 5 0 * * *")
    @Transactional
    public void cleanupOldShortBookings() {
        bookingRepo.deleteByDateBefore(LocalDate.now());
    }
}
