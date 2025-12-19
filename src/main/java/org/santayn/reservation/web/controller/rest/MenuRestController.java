package org.santayn.reservation.web.controller.rest;

import org.santayn.reservation.web.dto.menu.ActionDto;
import org.santayn.reservation.web.dto.menu.MenuResponse;
import org.santayn.reservation.web.dto.menu.MetaDto;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * REST-меню: возвращает метаданные для главного меню (куда ведут кнопки).
 * Сама схема здания — статикой в resources/static/menu.html.
 */
@RestController
public class MenuRestController {

    @GetMapping(value = "/app/mainmenu", produces = MediaType.APPLICATION_JSON_VALUE)
    public MenuResponse getMenu() {
        return new MenuResponse(
                "Главное меню",
                List.of(
                        // ⬇⬇⬇ Вернули прошлый рабочий адрес для статической страницы кабинета
                        new ActionDto("Личный кабинет", "/cabinet/me.html", "primary"),
                        new ActionDto("Выход", "/logout", "danger")
                ),
                OffsetDateTime.now().toString(),
                new MetaDto("reservation-ui", "1.0.0")
        );
    }
}
