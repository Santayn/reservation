package org.santayn.reservation.service;// src/main/java/org/santayn/reservation/services/TeacherScheduleService.java


import java.security.Principal;
import java.util.*;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;

import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.models.group.GroupTeacher;
import org.santayn.reservation.models.user.User;

import org.santayn.reservation.repositories.BookingRepository;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.repositories.GroupTeacherRepository;
import org.santayn.reservation.repositories.UserRepository;
import org.santayn.reservation.web.dto.lesson.LessonDto;
import org.santayn.reservation.web.dto.user.UserMeDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeacherScheduleService {

    private final UserService userService;                         // у тебя уже есть
    private final GroupTeacherRepository groupTeacherRepository;
    private final GroupRepository groupRepository;
    private final BookingRepository bookingRepository;

    /**
     * Возвращает расписание для текущего авторизованного преподавателя.
     * Преподаватель определяется через твой UserService.me(principal).
     */
    @Transactional(readOnly = true)
    public List<LessonDto> mySchedule(Principal principal) {
        UserMeDto me = userService.me(principal);                  // ← уже готовый метод
        Long teacherId = me.id();
        if (teacherId == null) return List.of();

        // Группы, к которым привязан преподаватель
        List<GroupTeacher> links = groupTeacherRepository.findByTeacher_Id(teacherId);
        if (links.isEmpty()) return List.of();

        Set<Long> groupIds = links.stream()
                .map(gt -> gt.getGroup().getId())
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        // Имена групп
        Map<Long, String> groupNames = groupRepository.findAllById(groupIds).stream()
                .collect(Collectors.toMap(
                        Group::getId,
                        g -> {
                            String n = g.getName();
                            if (n == null || n.isBlank()) n = g.getName();
                            return (n == null || n.isBlank()) ? ("Группа " + g.getId()) : n;
                        }
                ));

        // Бронирования этих групп
        var bookings = bookingRepository.findAllByGroupIdIn(groupIds);
        if (bookings.isEmpty()) return List.of();

        return bookings.stream()
                .map(b -> LessonDto.builder()
                        .bookingId(b.getId())
                        .dayOfWeek(b.getDayOfWeek())
                        .weekParityType(b.getWeekParityType())
                        .slotId(b.getSlotId())
                        .classroomId(b.getClassroomId())
                        .groupId(b.getGroupId())
                        .groupName(groupNames.getOrDefault(b.getGroupId(), "#" + b.getGroupId()))
                        .build())
                .sorted(Comparator
                        .comparing(LessonDto::getDayOfWeek, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(LessonDto::getSlotId, Comparator.nullsLast(Comparator.naturalOrder()))
                )
                .toList();
    }
}