import { ElementRef, Injectable } from "@angular/core";
import { CropperPosition, Dimensions, MoveStart } from "../interfaces";
import { CropperSettings } from "../interfaces/cropper.settings";
import { Subject } from "rxjs";

@Injectable({ providedIn: "root" })
export class CropperPositionService {

  lastPosition?: MoveStart;
  applyCustomCropper: Subject<{cropper: CropperPosition, lock: boolean}> = new Subject();

  processing = false;

  resetCropperPosition(
    sourceImage: ElementRef,
    cropperPosition: CropperPosition,
    settings: CropperSettings
  ): void {


    console.log('RESET!!!');

    if (!sourceImage?.nativeElement) {
      return;
    }
    const sourceImageElement = sourceImage.nativeElement;
    if (settings.cropperStaticHeight && settings.cropperStaticWidth) {
      cropperPosition.x1 = 0;
      cropperPosition.x2 =
        sourceImageElement.offsetWidth > settings.cropperStaticWidth
          ? settings.cropperStaticWidth
          : sourceImageElement.offsetWidth;
      cropperPosition.y1 = 0;
      cropperPosition.y2 =
        sourceImageElement.offsetHeight > settings.cropperStaticHeight
          ? settings.cropperStaticHeight
          : sourceImageElement.offsetHeight;
    } else {
      const cropperWidth = Math.min(
        settings.cropperScaledMaxWidth,
        sourceImageElement.offsetWidth
      );
      const cropperHeight = Math.min(
        settings.cropperScaledMaxHeight,
        sourceImageElement.offsetHeight
      );
      if (!settings.maintainAspectRatio) {
        cropperPosition.x1 = 0;
        cropperPosition.x2 = cropperWidth;
        cropperPosition.y1 = 0;
        cropperPosition.y2 = cropperHeight;
      } else if (
        sourceImageElement.offsetWidth / settings.aspectRatio <
        sourceImageElement.offsetHeight
      ) {
        cropperPosition.x1 = 0;
        cropperPosition.x2 = cropperWidth;
        const cropperHeightWithAspectRatio =
          cropperWidth / settings.aspectRatio;
        cropperPosition.y1 =
          (sourceImageElement.offsetHeight - cropperHeightWithAspectRatio) / 2;
        cropperPosition.y2 = cropperPosition.y1 + cropperHeightWithAspectRatio;
      } else {
        cropperPosition.y1 = 0;
        cropperPosition.y2 = cropperHeight;
        const cropperWidthWithAspectRatio =
          cropperHeight * settings.aspectRatio;
        cropperPosition.x1 =
          (sourceImageElement.offsetWidth - cropperWidthWithAspectRatio) / 2;
        cropperPosition.x2 = cropperPosition.x1 + cropperWidthWithAspectRatio;
      }
    }
  }

  move(event: any, moveStart: MoveStart, cropperPosition: CropperPosition) {
    const diffX = this.getClientX(event) - moveStart.clientX;
    const diffY = this.getClientY(event) - moveStart.clientY;

    cropperPosition.x1 = moveStart.x1 + diffX;
    cropperPosition.y1 = moveStart.y1 + diffY;
    cropperPosition.x2 = moveStart.x2 + diffX;
    cropperPosition.y2 = moveStart.y2 + diffY;
    console.log("move");
  }

  resize(
    event: any,
    moveStart: MoveStart,
    cropperPosition: CropperPosition,
    maxSize: Dimensions,
    settings: CropperSettings
  ): void {

    const previousPosition = {
      x1: cropperPosition.x1,
      x2: cropperPosition.x2,
      y1: cropperPosition.y1,
      y2: cropperPosition.y2
    }

    let moveX = this.getClientX(event) - moveStart.clientX;
    let moveY = this.getClientY(event) - moveStart.clientY;

    const wasBottomRight = moveStart.position === 'bottomright';

    const currW = cropperPosition.x2 - cropperPosition.x1;
    const currH = cropperPosition.y2 - cropperPosition.y1;

    const aspect = currW / currH;

    console.log(moveX, moveY);

    if(moveStart.position === 'bottomright' && settings.multipleAspectRatio) {


      if(moveX > 0 && moveY <= 0) {

        moveStart.position = 'right';
        moveY = 0;

      } else if (moveX <= 0 && moveY > 0) {

        moveStart.position = 'bottom';
        moveX = 0;

      } else {

        let max;

        if(Math.abs(moveX) > Math.abs(moveY))
          max = moveX;
        else
          max = moveY;

        if(currW > currH) {
          moveX = max;
          moveY = max / aspect;
        } else if (currW < currH) {
          moveX = max / aspect;
          moveY = max;
        } else {
          moveX = moveY = max;
        }
      }




      //if(true){

       // const force = Math.max(Math.abs(moveX), Math.abs(moveY));

      // if(moveX > 0 && moveY <= 0) {

      //   moveStart.position = 'right';
      //   moveY = 0;

      // } else if (moveX <= 0 && moveY > 0) {

      //   moveStart.position = 'bottom';
      //   moveX = 0;

      // } else {


        // } else if (moveX > 0 && moveY > 0) {

        // if(aspect > 1.5) {
        //   moveX = force * 1.5;
        //   moveY = force;
        // } else if (aspect < .75) {
        //   moveX = force;
        //   moveY = force / .75;
        // } else {
        //   moveX = force;
        //   moveY = force;
        // }

      // } else if (moveX < 0 && moveY < 0) {

        // if(aspect > 1.5) {
        //   moveX = -force * 1.5;
        //   moveY = -force;
        // } else if (aspect < .75) {
        //   moveX = -force;
        //   moveY = -force / .75;
        // } else {
        //   moveX = -force;
        //   moveY = -force;
        // }

      //}
  }

    switch (moveStart.position) {
      case "left":
        cropperPosition.x1 = Math.min(
          Math.max(
            moveStart.x1 + moveX,
            cropperPosition.x2 - settings.cropperScaledMaxWidth
          ),
          cropperPosition.x2 - settings.cropperScaledMinWidth
        );
        break;
      case "topleft":
        cropperPosition.x1 = Math.min(
          Math.max(
            moveStart.x1 + moveX,
            cropperPosition.x2 - settings.cropperScaledMaxWidth
          ),
          cropperPosition.x2 - settings.cropperScaledMinWidth
        );
        cropperPosition.y1 = Math.min(
          Math.max(
            moveStart.y1 + moveY,
            cropperPosition.y2 - settings.cropperScaledMaxHeight
          ),
          cropperPosition.y2 - settings.cropperScaledMinHeight
        );
        break;
      case "top":
        cropperPosition.y1 = Math.min(
          Math.max(
            moveStart.y1 + moveY,
            cropperPosition.y2 - settings.cropperScaledMaxHeight
          ),
          cropperPosition.y2 - settings.cropperScaledMinHeight
        );
        break;
      case "topright":
        cropperPosition.x2 = Math.max(
          Math.min(
            moveStart.x2 + moveX,
            cropperPosition.x1 + settings.cropperScaledMaxWidth
          ),
          cropperPosition.x1 + settings.cropperScaledMinWidth
        );
        cropperPosition.y1 = Math.min(
          Math.max(
            moveStart.y1 + moveY,
            cropperPosition.y2 - settings.cropperScaledMaxHeight
          ),
          cropperPosition.y2 - settings.cropperScaledMinHeight
        );
        break;
      case "right":
        cropperPosition.x2 = Math.max(
          Math.min(
            moveStart.x2 + moveX,
            cropperPosition.x1 + settings.cropperScaledMaxWidth
          ),
          cropperPosition.x1 + settings.cropperScaledMinWidth
        );
        break;
      case "bottomright":
        cropperPosition.x2 = Math.max(
          Math.min(
            moveStart.x2 + moveX,
            cropperPosition.x1 + settings.cropperScaledMaxWidth
          ),
          cropperPosition.x1 + settings.cropperScaledMinWidth
        );
        cropperPosition.y2 = Math.max(
          Math.min(
            moveStart.y2 + moveY,
            cropperPosition.y1 + settings.cropperScaledMaxHeight
          ),
          cropperPosition.y1 + settings.cropperScaledMinHeight
        );
        break;
      case "bottom":
        cropperPosition.y2 = Math.max(
          Math.min(
            moveStart.y2 + moveY,
            cropperPosition.y1 + settings.cropperScaledMaxHeight
          ),
          cropperPosition.y1 + settings.cropperScaledMinHeight
        );
        break;
      case "bottomleft":
        cropperPosition.x1 = Math.min(
          Math.max(
            moveStart.x1 + moveX,
            cropperPosition.x2 - settings.cropperScaledMaxWidth
          ),
          cropperPosition.x2 - settings.cropperScaledMinWidth
        );
        cropperPosition.y2 = Math.max(
          Math.min(
            moveStart.y2 + moveY,
            cropperPosition.y1 + settings.cropperScaledMaxHeight
          ),
          cropperPosition.y1 + settings.cropperScaledMinHeight
        );
        break;
      case "center":
        const scale = event.scale;
        const newWidth = Math.min(
          Math.max(
            settings.cropperScaledMinWidth,
            Math.abs(moveStart.x2 - moveStart.x1) * scale
          ),
          settings.cropperScaledMaxWidth
        );
        const newHeight = Math.min(
          Math.max(
            settings.cropperScaledMinHeight,
            Math.abs(moveStart.y2 - moveStart.y1) * scale
          ),
          settings.cropperScaledMaxHeight
        );
        cropperPosition.x1 = moveStart.clientX - newWidth / 2;
        cropperPosition.x2 = moveStart.clientX + newWidth / 2;
        cropperPosition.y1 = moveStart.clientY - newHeight / 2;
        cropperPosition.y2 = moveStart.clientY + newHeight / 2;
        if (cropperPosition.x1 < 0) {
          cropperPosition.x2 -= cropperPosition.x1;
          cropperPosition.x1 = 0;
        } else if (cropperPosition.x2 > maxSize.width) {
          cropperPosition.x1 -= cropperPosition.x2 - maxSize.width;
          cropperPosition.x2 = maxSize.width;
        }
        if (cropperPosition.y1 < 0) {
          cropperPosition.y2 -= cropperPosition.y1;
          cropperPosition.y1 = 0;
        } else if (cropperPosition.y2 > maxSize.height) {
          cropperPosition.y1 -= cropperPosition.y2 - maxSize.height;
          cropperPosition.y2 = maxSize.height;
        }
        break;
    }

    if (settings.maintainAspectRatio && !settings.multipleAspectRatio) {
      this.checkAspectRatio(
        moveStart.position!,
        cropperPosition,
        maxSize,
        settings
      );
    }

    if(settings.multipleAspectRatio) {
      this.applyMultipleAspect(previousPosition, cropperPosition, maxSize);
    }

    if(wasBottomRight)
      moveStart.position = 'bottomright';

  }

  checkAspectRatio(
    position: string,
    cropperPosition: CropperPosition,
    maxSize: Dimensions,
    settings: CropperSettings
  ): void {
    let overflowX = 0;
    let overflowY = 0;

    switch (position) {
      case "top":
        cropperPosition.x2 =
          cropperPosition.x1 +
          (cropperPosition.y2 - cropperPosition.y1) * settings.aspectRatio;
        overflowX = Math.max(cropperPosition.x2 - maxSize.width, 0);
        overflowY = Math.max(0 - cropperPosition.y1, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y1 +=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "bottom":
        cropperPosition.x2 =
          cropperPosition.x1 +
          (cropperPosition.y2 - cropperPosition.y1) * settings.aspectRatio;
        overflowX = Math.max(cropperPosition.x2 - maxSize.width, 0);
        overflowY = Math.max(cropperPosition.y2 - maxSize.height, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "topleft":
        cropperPosition.y1 =
          cropperPosition.y2 -
          (cropperPosition.x2 - cropperPosition.x1) / settings.aspectRatio;
        overflowX = Math.max(0 - cropperPosition.x1, 0);
        overflowY = Math.max(0 - cropperPosition.y1, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x1 +=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y1 +=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "topright":
        cropperPosition.y1 =
          cropperPosition.y2 -
          (cropperPosition.x2 - cropperPosition.x1) / settings.aspectRatio;
        overflowX = Math.max(cropperPosition.x2 - maxSize.width, 0);
        overflowY = Math.max(0 - cropperPosition.y1, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y1 +=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "right":
      case "bottomright":
        cropperPosition.y2 =
          cropperPosition.y1 +
          (cropperPosition.x2 - cropperPosition.x1) / settings.aspectRatio;
        overflowX = Math.max(cropperPosition.x2 - maxSize.width, 0);
        overflowY = Math.max(cropperPosition.y2 - maxSize.height, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "left":
      case "bottomleft":
        cropperPosition.y2 =
          cropperPosition.y1 +
          (cropperPosition.x2 - cropperPosition.x1) / settings.aspectRatio;
        overflowX = Math.max(0 - cropperPosition.x1, 0);
        overflowY = Math.max(cropperPosition.y2 - maxSize.height, 0);
        if (overflowX > 0 || overflowY > 0) {
          cropperPosition.x1 +=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY * settings.aspectRatio
              : overflowX;
          cropperPosition.y2 -=
            overflowY * settings.aspectRatio > overflowX
              ? overflowY
              : overflowX / settings.aspectRatio;
        }
        break;
      case "center":
        cropperPosition.x2 =
          cropperPosition.x1 +
          (cropperPosition.y2 - cropperPosition.y1) * settings.aspectRatio;
        cropperPosition.y2 =
          cropperPosition.y1 +
          (cropperPosition.x2 - cropperPosition.x1) / settings.aspectRatio;
        const overflowX1 = Math.max(0 - cropperPosition.x1, 0);
        const overflowX2 = Math.max(cropperPosition.x2 - maxSize.width, 0);
        const overflowY1 = Math.max(cropperPosition.y2 - maxSize.height, 0);
        const overflowY2 = Math.max(0 - cropperPosition.y1, 0);
        if (
          overflowX1 > 0 ||
          overflowX2 > 0 ||
          overflowY1 > 0 ||
          overflowY2 > 0
        ) {
          cropperPosition.x1 +=
            overflowY1 * settings.aspectRatio > overflowX1
              ? overflowY1 * settings.aspectRatio
              : overflowX1;
          cropperPosition.x2 -=
            overflowY2 * settings.aspectRatio > overflowX2
              ? overflowY2 * settings.aspectRatio
              : overflowX2;
          cropperPosition.y1 +=
            overflowY2 * settings.aspectRatio > overflowX2
              ? overflowY2
              : overflowX2 / settings.aspectRatio;
          cropperPosition.y2 -=
            overflowY1 * settings.aspectRatio > overflowX1
              ? overflowY1
              : overflowX1 / settings.aspectRatio;
        }
        break;
    }
  }

  getClientX(event: any): number {
    return event.touches?.[0].clientX || event.clientX || 0;
  }

  getClientY(event: any): number {
    return event.touches?.[0].clientY || event.clientY || 0;
  }

  applyMultipleAspect(previous: CropperPosition, current: CropperPosition, maxSize: Dimensions) {

    let growingW = false;
    let growingH = false;
    let downingW = false;
    let downingH = false;

    const prevW = previous.x2 - previous.x1;
    const prevH = previous.y2 - previous.y1;
    const currW = current.x2 - current.x1;
    const currH = current.y2 - current.y1;

    growingW = prevW < currW;
    growingH = prevH < currH;
    downingW = prevW > currW;
    downingH = prevH > currH;

    const aspect = currW / currH;

    let futW;
    let futH;

    let lock = false;

    if ((growingW && growingH) || (downingW && downingH)) {
      return;
    }

    if (aspect > 1.5) {
      if(downingH && !growingW) {
        futW = currH * 1.5;
      } else if (growingW && !downingH) {
        futH = currW / 1.5;
      }
    } else if (aspect < .75) {
      if (downingW && !growingH) {
        futH = currW / .75;
      } else if (growingH && !downingW) {
        futW = currH * .75;
      } else if (growingH) {
        futH = currW / .75;
      }
    }

    const future = {...current};

    if ((futW && futW !== currW) || (futH && futH !== currH)) {

      // auto ajust = aumentar w
      if (futW && futW > currW) {

        if (current.x2 == maxSize.width) {

          if(current.x1 == 0) {
            future.y2 = prevH; // trava h
            lock = true;

          } else {
            future.x1 -= futW - currW; // diminui x1
          }

        } else {
          future.x2 += futW - currW; // aumenta x2
        }
      }

      // auto ajust = aumentar h
      if (futH && futH > currH) {

        if (current.y2 == maxSize.height) { // altura maxima

          if (current.y1 == 0) { // altura full preenchida

            future.x2 = prevW; // trava w
            lock = true;

          } else {
            future.y1 -= futH - currH; // diminui y1
          }

        } else{
          future.y2 += futH - currH; // aumenta y2
        }
      }

      // diminuir w
      if (futW && futW < currW) {
        future.x2 -= currW - futW; // diminui x2
        console.log('LOW W');
      }

      // diminuir h
      if (futH && futH < currH) {
        future.y2 -= currH - futH; // diminui h2
        console.log('LOW H');
      }

      this.applyCustomCropper.next({cropper: future, lock});

    }

  }


}
