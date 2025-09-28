// org/santayn/reservation/service/GroupService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.web.dto.group.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service @RequiredArgsConstructor
public class GroupService {
    private final GroupRepository repo;

    @Transactional
    public GroupDto create(GroupCreateRequest r) {
        var g = Group.builder()
                .name(r.name())
                .title(r.title())
                .courseCode(r.courseCode())
                .build();
        g = repo.save(g);
        return new GroupDto(g.getId(), g.getName(), g.getTitle(), g.getCourseCode());
    }

    public List<GroupDto> list() {
        return repo.findAll().stream()
                .map(g -> new GroupDto(g.getId(), g.getName(), g.getTitle(), g.getCourseCode()))
                .toList();
    }
}
