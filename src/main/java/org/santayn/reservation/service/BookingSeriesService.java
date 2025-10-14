package org.santayn.reservation.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.santayn.reservation.repositories.BookingSeriesRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.santayn.reservation.models.booking.BookingSeries;
import org.santayn.reservation.models.classroom.Classroom;
import org.santayn.reservation.models.group.Group;

import org.santayn.reservation.web.dto.booking.BookingSeriesCreateRequest;
import org.santayn.reservation.web.dto.booking.BookingSeriesDto;
import org.santayn.reservation.web.dto.booking.BookingSeriesMapper;
import org.santayn.reservation.web.dto.booking.BookingSeriesUpdateRequest;

import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingSeriesService {

    private final BookingSeriesRepository bookingSeriesRepo;
    private final EntityManager em;

    @Transactional
    public BookingSeriesDto create(BookingSeriesCreateRequest r) {
        log.info("SERVICE.create -> in: {}", r);
        BookingSeries entity = BookingSeries.builder()
                .classroom(em.getReference(Classroom.class, r.classroomId()))
                .group(em.getReference(Group.class, r.groupId()))
                .timezone(r.timezone())
                .floor(r.floor())
                .dayOfWeek(r.dayOfWeek())
                .scheduleType(r.scheduleType())
                .weekType(r.weekType())
                .createdAt(OffsetDateTime.now())
                .build();

        log.info("SERVICE.create -> toSave: classroomId={}, groupId={}, tz={}, floor={}, day={}, scheduleType={}, weekType={}",
                r.classroomId(), r.groupId(), r.timezone(), r.floor(), r.dayOfWeek(), r.scheduleType(), r.weekType());

        entity = bookingSeriesRepo.save(entity);

        log.info("SERVICE.create -> saved: id={}", entity.getId());
        return BookingSeriesMapper.toDto(entity);
    }

    @Transactional(readOnly = true)
    public BookingSeriesDto get(Long id) {
        BookingSeries e = bookingSeriesRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("BookingSeries not found: id=" + id));
        return BookingSeriesMapper.toDto(e);
    }

    @Transactional
    public BookingSeriesDto update(Long id, BookingSeriesUpdateRequest r) {
        log.info("SERVICE.update id={} -> in: {}", id, r);
        BookingSeries e = bookingSeriesRepo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("BookingSeries not found: id=" + id));

        if (r.classroomId() != null) e.setClassroom(em.getReference(Classroom.class, r.classroomId()));
        if (r.groupId() != null) e.setGroup(em.getReference(Group.class, r.groupId()));
        if (r.timezone() != null) e.setTimezone(r.timezone());
        if (r.floor() != null) e.setFloor(r.floor());
        if (r.dayOfWeek() != null) e.setDayOfWeek(r.dayOfWeek());
        if (r.scheduleType() != null) e.setScheduleType(r.scheduleType());
        if (r.weekType() != null) e.setWeekType(r.weekType());

        // нормализация
        if (e.getScheduleType() == BookingSeries.ScheduleType.WEEKLY) {
            e.setWeekType(BookingSeries.WeekType.STABLE);
        }

        log.info("SERVICE.update -> toSave: classroomId={}, groupId={}, tz={}, floor={}, day={}, scheduleType={}, weekType={}",
                e.getClassroom() != null ? e.getClassroom().getId() : null,
                e.getGroup() != null ? e.getGroup().getId() : null,
                e.getTimezone(), e.getFloor(), e.getDayOfWeek(), e.getScheduleType(), e.getWeekType());

        e = bookingSeriesRepo.save(e);
        log.info("SERVICE.update -> saved: id={}", e.getId());
        return BookingSeriesMapper.toDto(e);
    }

    @Transactional
    public void delete(Long id) {
        if (!bookingSeriesRepo.existsById(id)) {
            throw new EntityNotFoundException("BookingSeries not found: id=" + id);
        }
        bookingSeriesRepo.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Page<BookingSeriesDto> search(Long classroomId,
                                         Long groupId,
                                         String timezone,
                                         Integer floor,
                                         Integer dayOfWeek,
                                         BookingSeries.ScheduleType scheduleType,
                                         BookingSeries.WeekType weekType,
                                         OffsetDateTime createdFrom,
                                         OffsetDateTime createdTo,
                                         Pageable pageable) {

        var spec = org.springframework.data.jpa.domain.Specification.<BookingSeries>where(null);
        if (classroomId != null) spec = spec.and((r, q, cb) -> cb.equal(r.get("classroom").get("id"), classroomId));
        if (groupId != null)     spec = spec.and((r, q, cb) -> cb.equal(r.get("group").get("id"), groupId));
        if (timezone != null && !timezone.isBlank()) spec = spec.and((r, q, cb) -> cb.equal(r.get("timezone"), timezone));
        if (floor != null)       spec = spec.and((r, q, cb) -> cb.equal(r.get("floor"), floor));
        if (dayOfWeek != null)   spec = spec.and((r, q, cb) -> cb.equal(r.get("dayOfWeek"), dayOfWeek));
        if (scheduleType != null)spec = spec.and((r, q, cb) -> cb.equal(r.get("scheduleType"), scheduleType));
        if (weekType != null)    spec = spec.and((r, q, cb) -> cb.equal(r.get("weekType"), weekType));
        if (createdFrom != null) spec = spec.and((r, q, cb) -> cb.greaterThanOrEqualTo(r.get("createdAt"), createdFrom));
        if (createdTo != null)   spec = spec.and((r, q, cb) -> cb.lessThanOrEqualTo(r.get("createdAt"), createdTo));

        Page<BookingSeriesDto> page = bookingSeriesRepo.findAll(spec, pageable).map(BookingSeriesMapper::toDto);
        log.info("SERVICE.search -> total={}", page.getTotalElements());
        return page;
    }
}
