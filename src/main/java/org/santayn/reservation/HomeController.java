// src/main/java/org/santayn/reservation/HomeController.java
package org.santayn.reservation;


import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {
    @GetMapping({"/", "/cabinet"})
    public String cabinet() {
        return "redirect:/cabinet/index.html";
    }
}
