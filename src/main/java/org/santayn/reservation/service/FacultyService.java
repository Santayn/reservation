package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.faculty.Faculty;
import org.santayn.reservation.repositories.FacultyRepository;
import org.santayn.reservation.web.dto.faculty.FacultyCreateRequest;
import org.santayn.reservation.web.dto.faculty.FacultyDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
public class FacultyService {

    private final FacultyRepository repo;

    @Transactional
    public FacultyDto create(FacultyCreateRequest r) {
        var f = repo.save(Faculty.builder().name(r.name()).build());
        return new FacultyDto(f.getId(), f.getName());
    }

    @Transactional
    public void delete(Long id) {
        if (!repo.existsById(id)) {
            throw new NoSuchElementException("Факультет с id=" + id + " не найден");
        }
        repo.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<FacultyDto> list() {
        return repo.findAll().stream()
                .map(f -> new FacultyDto(f.getId(), f.getName()))
                .toList();
    }
}
