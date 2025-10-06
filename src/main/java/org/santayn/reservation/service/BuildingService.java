package org.santayn.reservation.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.building.Building;
import org.santayn.reservation.repositories.BuildingRepository;
import org.santayn.reservation.web.dto.building.BuildingDto;
import org.santayn.reservation.web.dto.building.CreateBuildingRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Бизнес-логика по работе с корпусами.
 */
@Service
@Transactional
@RequiredArgsConstructor
public class BuildingService {

    private final BuildingRepository buildingRepository;

    /**
     * Список всех корпусов (отсортирован по id).
     */
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<BuildingDto> list() {
        return buildingRepository.findAll().stream()
                .sorted((a, b) -> Long.compare(
                        a.getId() == null ? Long.MIN_VALUE : a.getId(),
                        b.getId() == null ? Long.MIN_VALUE : b.getId()))
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    /**
     * Создание корпуса.
     *
     * @throws IllegalArgumentException            если имя пустое
     * @throws DataIntegrityViolationException     если нарушена уникальность имени
     */
    public BuildingDto create(CreateBuildingRequest request) {
        Objects.requireNonNull(request, "request");
        final String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Название корпуса не может быть пустым");
        }

        // Явная предвалидация (опционально; можно полагаться на уникальный индекс БД)
        // if (buildingRepository.existsByNameIgnoreCase(name)) {
        //     throw new DataIntegrityViolationException("Корпус с таким названием уже существует");
        // }

        Building entity = Building.builder()
                .name(name)
                .adminUser(null) // при необходимости можно проставить текущего пользователя
                .build();

        Building saved = buildingRepository.save(entity);
        return toDto(saved);
    }

    /**
     * Идемпотентное удаление корпуса по id.
     */
    public void delete(long id) {
        if (buildingRepository.existsById(id)) {
            buildingRepository.deleteById(id);
        }
    }

    private BuildingDto toDto(Building b) {
        return new BuildingDto(b.getId(), b.getName());
    }
}
