// org/santayn/reservation/service/GroupService.java
package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.group.Group;
import org.santayn.reservation.repositories.GroupRepository;
import org.santayn.reservation.web.dto.group.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
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

    @Transactional(readOnly = true)
    public List<GroupDto> list() {
        return repo.findAll().stream()
                .map(g -> new GroupDto(g.getId(), g.getName(), g.getTitle(), g.getCourseCode()))
                .toList();
    }

    // 🔥 Новый метод — удаление группы
    // org/santayn/reservation/service/GroupService.java
    @Transactional
    public void delete(Long id) {
        Integer intId = Math.toIntExact(id); // безопасно, если id помещается в int
        if (!repo.existsById(intId)) {
            throw new NoSuchElementException("Группа с id=" + id + " не найдена");
        }
        repo.deleteById(intId);
    }

}
