// org/santayn/reservation/service/TeacherGroupService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.teacher.Teacher_Group;
import org.santayn.reservation.repositories.*;
import org.santayn.reservation.web.dto.teacher.TeacherGroupCreateRequest;
import org.santayn.reservation.web.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class TeacherGroupService {
    private final TeacherGroupRepository repo;
    private final TeacherRepository teacherRepo;
    private final GroupRepository groupRepo;

    @Transactional
    public void create(TeacherGroupCreateRequest r) {
        // валидация существования
        teacherRepo.findById(r.teacherId())
                .orElseThrow(() -> new NotFoundException("Teacher not found: " + r.teacherId()));
        groupRepo.findById(r.groupId())
                .orElseThrow(() -> new NotFoundException("Group not found: " + r.groupId()));
        // защита от дублей
        if (!repo.existsByTeacherIdAndGroupId(r.teacherId(), r.groupId())) {
            repo.save(Teacher_Group.builder()
                    .teacherId(r.teacherId())
                    .groupId(r.groupId())
                    .build());
        }
    }
}
