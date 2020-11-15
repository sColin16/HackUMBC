let isHandlerDragging = false;
let MIN_WIDTH_MAIN_PANEL = 400;
let rooms = [];
let resizer = null;
let modal = null;
let currentUser = null;
//Thanks to https://htmldom.dev/create-resizable-split-views/ for the resizing script
function setUsername(){
    currentUser = document.getElementById("username").value;
    closeModal();
}
document.addEventListener('DOMContentLoaded', function() {
    modal = document.getElementById("myModal");

    launchModal();

    let videos = document.getElementsByClassName("videoContainer")
    Array.prototype.forEach.call(videos, videoScreen =>{
        makeElementDraggable(videoScreen);
    });
        // Query the element
    resizer = document.getElementById('panelDivider');
    const leftSide = resizer.previousElementSibling;
    const rightSide = resizer.nextElementSibling;
    // The current position of mouse
    let mouseX = 0;
    let mouseY = 0;
    let leftWidth = 0;

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = function(e) {
        // Get the current mouse position
        mouseX = e.clientX;
        mouseY = e.clientY;
        leftWidth = leftSide.getBoundingClientRect().width;

        // Attach the listeners to `document`
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function(e) {
        // How far the mouse has been moved
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;

        const newLeftWidth = (leftWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
        leftSide.style.width = `${newLeftWidth}%`;

        resizer.style.cursor = 'col-resize';
        document.body.style.cursor = 'col-resize';

        leftSide.style.userSelect = 'none';
        leftSide.style.pointerEvents = 'none';

        rightSide.style.userSelect = 'none';
        rightSide.style.pointerEvents = 'none';
    };

    const mouseUpHandler = function() {
        resizer.style.removeProperty('cursor');
        document.body.style.removeProperty('cursor');

        leftSide.style.removeProperty('user-select');
        leftSide.style.removeProperty('pointer-events');

        rightSide.style.removeProperty('user-select');
        rightSide.style.removeProperty('pointer-events');
        // Remove the handlers of `mousemove` and `mouseup`
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
});
function deleteRooms(){
    rooms.forEach(room =>{
        if(room.isSelected){
            room.domElement.remove();
        }
    });
}
function addNewRoom(){
    let roomContainer = document.getElementById('roomContainer')
    let newRoom = new Room(rooms.length, null)

    newRoom.makeDomElement();
    newRoom.domElement.onmouseover = function(){
        newRoom.isMousedOver = true;
    }
    newRoom.domElement.onmouseleave = function(){
        newRoom.isMousedOver = false;
    }
    newRoom.domElement.onmousedown = function(){
        if(!isHandlerDragging)
            newRoom.isSelected = !newRoom.isSelected;
        if(newRoom.isSelected){
            newRoom.domElement.style.background = "rgb(176,196,222)"
        }else{
            newRoom.domElement.style.background = "none"
        }
    }
    rooms.push(newRoom);
    roomContainer.appendChild(newRoom.domElement);
}
//ROOM OBJECT
function Room(roomID){
    this.id = roomID;
    this.isMousedOver = false;
    this.isSelected = false;
    this.makeDomElement = function() {
        let roomElement = document.createElement("div");
        roomElement.classList.add('room');
        this.domElement = roomElement;
    };
    this.domElement = null;
}

function inRoom(){
    let out = false;
    rooms.forEach(room =>{
        if(room.isMousedOver){
            out = true;
        }
    });
    return out;
}
function getRoomDiv(){
    let out = null
    rooms.forEach(room =>{
        if(room.isMousedOver){
            out = room.domElement;
        }
    });
    return out;
}

function makeElementDraggable(elem) {
    let pos1 = 0, pos2 = 0, initialMouseX = 0, initialMouseY = 0, firstX = 0, firstY = 0;
    let img = elem.querySelector("img")
    let oldSize = 200;
    elem.onmousedown = dragMouseDown;
    function dragMouseDown(e) {
        isHandlerDragging =true;
        elem.style.pointerEvents = "none";
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        firstX = initialMouseX;
        firstY = initialMouseY;
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // calculate the new cursor position:
        let topPos = elem.getBoundingClientRect().top
        let leftPos = elem.getBoundingClientRect().left
        pos1 = initialMouseX - e.clientX;
        pos2 = initialMouseY - e.clientY;
        initialMouseX = e.clientX;
        initialMouseY = e.clientY;
        // set the element's new position:
        elem.style.position = "absolute"
        elem.style.top = (topPos - pos2) + "px";
        elem.style.left =(leftPos - pos1) + "px";
        centerX = resizer.getBoundingClientRect().left;
        img.style.borderRadius = 50-((centerX-e.clientX)/10)+"%";
        //console.log(oldSize-((centerX-e.clientX)/10));
        img.style.zIndex = 99;
    }

    function closeDragElement(e) {
        e = e || window.event;
        e.preventDefault();
        if(inRoom()){
            let destination = getRoomDiv()
            destination.appendChild(elem);
            img.style.borderRadius = 50 +"%";
        } else{
            img.style.borderRadius = 0;
        }
        //else go back to before
        elem.style.position = "relative"
        elem.style.top =  0;
        elem.style.left = 0;
        img.style.zIndex = 0;

        /* stop moving when mouse button is released:*/
        elem.style.pointerEvents = "auto";
        document.onmouseup = null;
        document.onmousemove = null;
        isHandlerDragging = false;
    }
}

//MODAL STUFF


// When the user clicks the button, open the modal
function launchModal(){
    modal.style.display = "block";
}

// When the user clicks on <span> (x), close the modal
function closeModal() {
    modal.style.display = "none";
}
