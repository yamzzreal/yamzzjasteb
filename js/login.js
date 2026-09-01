/*
=========================================================
YAMZZ MARKET
ADMIN LOGIN
=========================================================
*/


/*
 * KONFIGURASI
 *
 * GANTI DENGAN DATA ADMIN LU
 */

const ADMIN_CONFIG = {

    username: "yamzz",

    password: "YamzzMarket"

};


/*
=========================================================
ELEMENT
=========================================================
*/

const loginForm =
    document.getElementById("loginForm");

const usernameInput =
    document.getElementById("username");

const passwordInput =
    document.getElementById("password");

const loginError =
    document.getElementById("loginError");

const togglePassword =
    document.getElementById("togglePassword");


/*
=========================================================
CEK SESSION
=========================================================
*/

if (
    sessionStorage.getItem("yamzz_admin_authenticated") === "true"
) {

    window.location.replace("admin.html");

}


/*
=========================================================
TOGGLE PASSWORD
=========================================================
*/

togglePassword.addEventListener(
    "click",
    function () {

        const isPassword =
            passwordInput.type === "password";

        passwordInput.type =
            isPassword
                ? "text"
                : "password";

        this.innerHTML =
            isPassword
                ? '<i class="fa-solid fa-eye-slash"></i>'
                : '<i class="fa-solid fa-eye"></i>';

    }
);


/*
=========================================================
LOGIN
=========================================================
*/

loginForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        const username =
            usernameInput.value.trim();

        const password =
            passwordInput.value;


        loginError.textContent = "";


        if (!username || !password) {

            showError(
                "Username dan password wajib diisi."
            );

            return;

        }


        if (
            username !== ADMIN_CONFIG.username ||
            password !== ADMIN_CONFIG.password
        ) {

            showError(
                "Username atau password salah."
            );

            passwordInput.value = "";

            return;

        }


        /*
         * Session admin
         */

        sessionStorage.setItem(
            "yamzz_admin_authenticated",
            "true"
        );

        sessionStorage.setItem(
            "yamzz_admin_time",
            String(Date.now())
        );


        /*
         * Redirect
         */

        window.location.replace(
            "admin.html"
        );

    }
);


/*
=========================================================
ERROR
=========================================================
*/

function showError(message) {

    loginError.textContent =
        message;

    loginError.classList.add("show");

    setTimeout(() => {

        loginError.classList.remove("show");

    }, 3500);

}