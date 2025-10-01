package org.santayn.reservation.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.booking.Booking_Group;
import org.santayn.reservation.repositories.BookingGroupRepository;
import org.santayn.reservation.repositories.BookingRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.repositories.ScheduleSlotRepository;
import org.santayn.reservation.web.dto.booking.BookingCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingDTO;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BookingService {

    private final BookingRepository bookingRepo;
    private final BookingGroupRepository bookingGroupRepo;
    private final ScheduleSlotRepository scheduleSlotRepo;
    private final GroupRepository groupRepo;

    @Transactional
    public BookingDTO create(BookingCreateRequest r){

        var b = bookingRepo.save(
                Booking.builder()
                        .slot(scheduleSlotRepo.findById(r.getSlotID()).orElseThrow())
                        .status(Booking.Status.PENDING)
                        .createdAt(LocalDateTime.now())
                        .comment(r.getComment())
                        .build()
        );

        var bg = groupRepo
                .findAllById(r.getGroupIDs())
                .stream()
                .map(group
                        -> Booking_Group.builder()
                        .bookingId(b.getId())
                        .groupId(group.getId())
                        .build())
                .collect(Collectors.toList());

        bookingGroupRepo.saveAll(bg);
        return new BookingDTO(
                b.getId(),
                b.getSlot().getId(),
                b.getStatus().name(),
                b.getCreatedAt(),
                b.getComment()
                );
    }


}
