package org.santayn.reservation.service;

import lombok.RequiredArgsConstructor;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.santayn.reservation.web.dto.map.ClassroomLoadDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UtilizationService {

    private final JdbcTemplate jdbc;

    @Transactional(readOnly = true)
    public List<ClassroomLoadDto> utilizationByDateAndSlot(LocalDate date, Long slotId) {
        String sql = """
            with load_by_room as (
                select b.classroom_id,
                       coalesce(sum(g.persons_count), 0) as load
                from bookings b
                left join booking_groups bg on bg.booking_id = b.id
                left join groups g on g.id = bg.group_id
                where b.booking_date = ? and b.slot_id = ?
                group by b.classroom_id
            )
            select c.id as classroom_id,
                   c.name as classroom_name,
                   c.capacity as capacity,
                   coalesce(l.load, 0) as load
            from classrooms c
            left join load_by_room l on l.classroom_id = c.id
            order by c.name
            """;

        return jdbc.query(sql, (rs, row) -> mapRow(rs), date, slotId);
    }

    @Transactional(readOnly = true)
    public List<ClassroomLoadDto> roomLoads(LocalDate date,
                                            DayOfWeek dayOfWeek,
                                            WeekParityType weekParityType,
                                            Long slotId,
                                            Long buildingId,
                                            Long facultyId,
                                            Long specializationId,
                                            Long teacherId) {
        if (date == null) {
            throw new IllegalArgumentException("date is required");
        }
        if (dayOfWeek == null) {
            throw new IllegalArgumentException("dayOfWeek is required");
        }
        if (slotId == null) {
            throw new IllegalArgumentException("slotId is required");
        }

        StringBuilder sql = new StringBuilder("""
            select c.id as classroom_id,
                   c.name as classroom_name,
                   c.capacity as capacity,
                   coalesce(sum(g.persons_count), 0) as load
              from classrooms c
              left join bookings b
                on b.classroom_id = c.id
               and b.day_of_week = ?
               and b.slot_id = ?
               and (b.booking_date is null or b.booking_date = ?)
            """);

        List<Object> params = new ArrayList<>();
        params.add(dayOfWeek.name());
        params.add(slotId);
        params.add(date);

        if (weekParityType != null) {
            sql.append("   and b.week_parity_type = ?\n");
            params.add(weekParityType.name());
        }

        if (teacherId != null) {
            sql.append("   and b.teacher_id = ?\n");
            params.add(teacherId);
        }

        sql.append("  left join groups g on g.id = b.group_id\n");
        sql.append(" where 1 = 1\n");

        if (buildingId != null) {
            sql.append("   and c.building_id = ?\n");
            params.add(buildingId);
        }
        if (facultyId != null) {
            sql.append("""
                   and exists (
                       select 1
                         from classroom_faculty cf
                        where cf.classroom_id = c.id
                          and cf.faculty_id = ?
                   )
                """);
            params.add(facultyId);
        }
        if (specializationId != null) {
            sql.append("""
                   and exists (
                       select 1
                         from classroom_specialization cs
                        where cs.classroom_id = c.id
                          and cs.specialization_id = ?
                   )
                """);
            params.add(specializationId);
        }

        sql.append("""
             group by c.id, c.name, c.capacity
             order by c.name
            """);

        return jdbc.query(sql.toString(), (rs, row) -> mapRow(rs), params.toArray());
    }

    private ClassroomLoadDto mapRow(ResultSet rs) throws SQLException {
        long roomId = rs.getLong("classroom_id");
        String name = rs.getString("classroom_name");
        int capacity = rs.getInt("capacity");
        int load = rs.getInt("load");

        double util = capacity == 0 ? 0.0 : (double) load / (double) capacity;
        String badge = classify(util);

        return new ClassroomLoadDto(roomId, name, capacity, load, util, badge);
    }

    private String classify(double util) {
        if (util <= 0.0) return "util-empty";   // пусто
        if (util <= 0.25) return "util-25";     // до 25%
        if (util <= 0.5)  return "util-50";     // до 50%
        if (util <= 1.0)  return "util-100";    // ≤100%
        return "util-over";                     // >100%
    }
}
